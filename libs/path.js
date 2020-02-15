const PATH = require('path');

/**
 * Convert any absolute path into dynamic path. Platform independend, forward slashes only
 *
 * @param {string} absolutePath absolute path to folder or file
 * @param {string} absoluteBasePath absolute path where data root is defined
 * @returns {string} dynamic path (in posix absolute format)
 *
 * @see /test/path.js
 */
function absoluteToRelative(absolutePath, absoluteBasePath) {
	if (typeof absolutePath !== 'string' || PATH.isAbsolute(absolutePath) === false) {
		throw new Error('Parameter "absolutePath" has to be absolute path but provided "' + absolutePath + '"');
	}
	if (typeof absoluteBasePath !== 'string' || PATH.isAbsolute(absoluteBasePath) === false) {
		throw new Error('Parameter "absoluteBasePath" has to be absolute path but provided "' + absoluteBasePath + '"');
	}
	absolutePath = absolutePath.replaceAll(/\\/g, '/');
	absoluteBasePath = absoluteBasePath.replaceAll(/\\/g, '/');
	if (absolutePath.indexOf(absoluteBasePath) !== 0) {
		throw new Error('Parameter "path" has to contain path of "absoluteBasePath"');
	}
	absolutePath = absolutePath.replace(absoluteBasePath, '/');
	return absolutePath;
}

module.exports.absoluteToRelative = absoluteToRelative;

/**
 * Convert any dynamic path into absolute path. Platform independend, forward slashes only
 *
 * @param {string} relativePath dynamic path to folder or file (in posix absolute format)
 * @param {string} absoluteBasePath absolute path where data root is defined
 * @returns {string} absolute path
 *
 * @see /test/path.js
*/
function relativeToAbsolute(relativePath, absoluteBasePath) {
	if (typeof relativePath !== 'string' || PATH.posix.isAbsolute(relativePath) === false) {
		throw new Error('Parameter "relativePath" has to be absolute path but provided "' + relativePath + '"');
	}
	if (typeof absoluteBasePath !== 'string' || PATH.isAbsolute(absoluteBasePath) === false) {
		throw new Error('Parameter "absoluteBasePath" has to be absolute path but provided "' + absoluteBasePath + '"');
	}
	relativePath = relativePath.replaceAll(/\\/g, '/');
	absoluteBasePath = absoluteBasePath.replaceAll(/\\/g, '/');
	relativePath = PATH.posix.join(absoluteBasePath, relativePath).replaceAll(/\\/g, '/');

	return relativePath;
}

module.exports.relativeToAbsolute = relativeToAbsolute;

/**
 * Get extname without dot
 *
 * @param path
 */
function extname(path) {
	return PATH.extname(path).toLowerCase().replace('.', '');
}

module.exports.extname = extname;
