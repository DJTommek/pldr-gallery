const FS = require('fs');
const PATH = require('path');

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

