const FS = require('fs');
const PATH = require('path');
const readline = require('readline');

/**
 * Unite path to UNIX type even on Windows
 * - fixes relative path
 *
 * @param path
 * @param dynamic (optional) make path dynamic by removing start of path
 * @returns {string}
 */
function pathNormalize(path, dynamic) {
    path = PATH.normalize(path);
    path = path.replace(/\\/g, '/');
    if (typeof dynamic === 'string' && PATH.isAbsolute(dynamic)) {
        path = path.replace(pathNormalize(dynamic), '/');
    }
    return path;
}
module.exports.pathNormalize = pathNormalize;

function pathJoin(...paths) {
    return pathNormalize(PATH.join(...paths));
}
module.exports.pathJoin = pathJoin;

/**
 * The same as PATH.dirname but keep trailing /
 *
 * @param path
 */
function pathDirname(path) {
    path = PATH.join(PATH.dirname(path), '/');
    return path.replace(/\\/g, '/');
}
module.exports.pathDirname = pathDirname;

/**
 * Get extname without dot
 *
 * @param path
 */
function extname(path) {
    return PATH.extname(path).toLowerCase().replace('.', '');
}
module.exports.extname = extname;

/**
 * Get content of file
 *
 * @param {{}} options
 * - {string} file which file do we want to read
 * - {number} [limit] limit number of files (default 1000), 0 = all
 * - {number} [offset] how many lines should be skipped (default 0)
 * - {number} [order] order of log lines (default 'ASC' = oldest first)
 * @param {function(string|null, Array)} callback
 */
function getFileLines(options , callback)
{
    try {
        // check required parametr file name
        if (!options || !options.file) {
            throw new Error('Param "options.file" is required.');
        }
        // check optional parameter limit
        if (options.limit) {
            if (typeof options.limit !== 'number' || options.limit < 0) {
                throw new Error('Param options.limit is not valid. It must be positive number.');
            }
        } else { // set default value
            options.limit = 1000;
        }
        // check optional parameter offset
        if (options.offset) {
            if (typeof options.offset !== 'number' || options.offset < 0) {
                throw new Error('Param options.offset is not valid. It must be positive number.');
            }
            throw new Error('Param options.offset is not implemented.'); // @TODO implement offset
        } else { // set default value
            options.offset = 1000;
        }
        // check optional parameter order
        const allowedOrders = ['asc', 'desc'];
        if (options.order) {
            if (allowedOrders.inArray(options.order) === false) {
                throw new Error('Param options.order is not valid. It must be "' + allowedOrders.join('" or "') + '".');
            }
        } else { // set default value
            options.order = allowedOrders[0];
        }
    } catch (error) {
        return callback(error.message, []);
    }

    let fileStream = FS.createReadStream(options.file);
    fileStream.on('error', function (error) {
        return callback(error.message, []);
    });
    let readLogfile = readline.createInterface({
        input: fileStream
    });
    let lines = [];
    readLogfile.on('line', function (line) {
        if (options.limit > 0 && lines.length >= options.limit) {
            // Chceme jen posledních x řádků, udržujeme velikost pole
            // tj. u kazdeho pridaneho prvku je potreba odstranit prvni prvek v poli
            if (options.order === 'desc') {
                lines.shift();
            } else {
                readLogfile.close();
            }
        }
        lines.push(line);
    });
    readLogfile.on('close', function () {
        if (options.order === 'desc') {
            lines = lines.reverse();
        }
        callback(null, lines);
    });
}
module.exports.readFileContent = getFileLines;
