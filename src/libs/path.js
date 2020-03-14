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
module.exports.absoluteToRelative = function (absolutePath, absoluteBasePath) {
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
};

/**
 * Convert any dynamic path into absolute path. Platform independend, forward slashes only
 *
 * @param {string} relativePath dynamic path to folder or file (in posix absolute format)
 * @param {string} absoluteBasePath absolute path where data root is defined
 * @returns {string} absolute path
 *
 * @see /test/path.js
 */
module.exports.relativeToAbsolute = function (relativePath, absoluteBasePath) {
	if (typeof relativePath !== 'string' || PATH.posix.isAbsolute(relativePath) === false) {
		throw new Error('Parameter "relativePath" has to be absolute path but provided "' + relativePath + '"');
	}
	if (typeof absoluteBasePath !== 'string' || PATH.isAbsolute(absoluteBasePath) === false) {
		throw new Error('Parameter "absoluteBasePath" has to be absolute path but provided "' + absoluteBasePath + '"');
	}
	relativePath = relativePath.replaceAll(/\\/g, '/');
	absoluteBasePath = absoluteBasePath.replaceAll(/\\/g, '/');
	relativePath = this.join(absoluteBasePath, relativePath);

	return relativePath;
};

/**
 * Get extname without dot
 *
 * @param {string} path
 */
module.exports.extname = function (path) {
	return PATH.extname(path).toLowerCase().replace('.', '');
};


/**
 * Join paths in posix compatible
 *
 * @param {string} paths
 * @returns {string}
 */
module.exports.join = function(...paths) {
	return PATH.join(...paths).replace(/\\/g, '/');
};

/**
 * Get dirname with trailing slash
 *
 * @param {string} path
 * @returns {string}
 */
module.exports.dirname = function(path) {
	return this.join(PATH.dirname(path), '/');
};

module.exports.defineBaseDir = function(path) {
	/**
	 * Define base dir of app to place, where main file (usually index.js) is located.
	 * Don't matter from which folder you run this app, BASE_DIR will be always absolute path to folder, where main file (usually index.js) is located.
	 *
	 * @type {string} absolute path
	 */
	global.BASE_DIR = module.exports.dirname(path);

	/**
	 * Generate absolute path for dynamically path
	 *
	 * @param path dynamic path from dir, where main file is located (usually index.js)
	 * @returns {string} absolute path
	 */
	global.BASE_DIR_GET = function(path) {
		return module.exports.join(BASE_DIR, path);
	};
};
