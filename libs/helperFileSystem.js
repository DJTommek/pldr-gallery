const FS = require('fs');
const PATH = require('path');
const readline = require('readline');
/**
 * Exactly as PATH.posix.normalize but replacing backslashes with UNIX slashes (\ -> /)
 *
 * @see PATH.posix.normalize()
 * @param {string} path
 * @returns {string}
 */
PATH.posix.normalizeForce = function(path) {
    return this.posix.normalize(path.replace(/\\/g, '/'));
};

/**
 * Unite path to UNIX type even on Windows
 * - fixes relative path
 *
 * @param path
 * @param dynamic (optional) make path dynamic by removing start of path
 * @returns {string}
 */
function pathNormalize(path, dynamic) {
    path = PATH.posix.normalize(path);
    if (typeof dynamic === 'string' && PATH.isAbsolute(dynamic)) {
        path = path.replace(pathNormalize(dynamic), '/');
    }
    return path;
}
module.exports.pathNormalize = pathNormalize;

/**
 * Create dynamic link
 *
 * @example /data/photos/, /data/photos/cats/ -> /cats/
 * @param {string} fullBasePath
 * @param {string} fullPath
 * @returns {string}
 */
function pathMakeDynamic(fullBasePath, fullPath) {
    // if (PATH.isAbsolute(fullBasePath) === false) {
    //     console.log('fullBasePath (' + fullBasePath + ') is not absolute. Add ./ to fullPath (' + fullPath + ')');
    //     fullPath = './' + fullPath;
    // }
    // console.log(fullPath);
    // console.log(PATH.isAbsolute(fullBasePath));
    // if (PATH.isAbsolute(fullBasePath) === false) {
    //     console.log(fullBasePath);
    //     throw new Error('Param "fullBasePath" must be absolute path');
    // }
    // if (PATH.isAbsolute(fullPath) === false) {
    //     console.log(fullPath);
    //     throw new Error('Param "fullPath" must be absolute path');
    // }
    if (fullPath.indexOf(fullBasePath) !== 0) {
        throw new Error('Param "basePath" dont have same base structure as "fullBasePath"');
    }
    return fullPath.replace(fullBasePath, '/');
}
module.exports.pathMakeDynamic = pathMakeDynamic;

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

/**
 * Check for requested path if is valid, allowed for user, etc
 *
 * @param {string} basePath Absolute path from config
 * @param {string} requestedPathBase64
 * @param {Array.<string>} userPermissions
 * @param {function(Array, string)} permsTest function whichaccept Array as list of permissions and string as path which should be checked. Returns boolean (true if should have permission)
 * @returns {{string}} JSON with basic values.
 * If attribute "error" is defined, something went wrong.
 * If attribute "path" is defined everything is ok. Also one of "fullPathFolder" or "fullPathFile" is defined too, depends on request
 */
function pathMasterCheck(basePath, requestedPathBase64, userPermissions, permsTest) {
    let result = {};
    if (typeof requestedPathBase64 !== 'string') {
        result.error = 'Parameter "requestedPathBase64" has to be string.';
        return result;
    }
    let path = requestedPathBase64;
    path = decodeURIComponent(Buffer.from(path, 'base64').toString());
    result.queryPath = path;
    if (path.includes('\\')) { // Windows backslashes are not supported - everything has to be written in POSIX (UNIX) way.
        result.error = 'Backslash is not allowed';
        return result;
    } else if (path.indexOf('/') !== 0) {
        result.error = 'Query path has to start with forward slash';
        return result;
    } else if (path.includes('*')) { // this char is used for matching any number of characters (see npm module micromatch)
        result.error = 'Asterisk is not allowed';
        return result;
    } else if (path.includes('?')) { // this char is used for matching any character (see npm module micromatch)
        result.error = 'Questionmark is not allowed';
        return result;
    } else if (path.includes('/../') || path.includes('/./')) {
        result.error = 'Dynamic path is not allowed';
        return result;
    } else if (permsTest(userPermissions, path) === false) {
        // path is already normalized
        result.error = 'User do not have permissions to path "' + path + '"';
        return result;
    }
    console.log(basePath);
    console.log(path);
    const fullPath = (basePath + '' + path).replace(/\/{2,}/, '/');
    // const fullPath = PATH.posix.join(basePath, '/', path);
    console.log(fullPath);
    let fileStats;
    try {
        fileStats = FS.lstatSync(fullPath); // throws exception if not exists or not accessible
    } catch (error) {
        result.error = 'Cant load "' + path + '", error: ' + error.message;
        return result;
    }
    if (fullPath.match(/\/$/)) { // requested path wants folder
        if (fileStats.isDirectory()) {
            result.fullPathFolder = fullPath;
        } else {
            result.error = 'Requested path "' + path + '" is not folder';
        }
    } else { // Requested path wants file
        if (fileStats.isFile()) {
            result.fullPathFile = fullPath;
        } else {
            result.error = 'Requested path "' + path + '" is not file';
        }
    }
    result.path = path;
    return result;
}
module.exports.pathMasterCheck = pathMasterCheck;
