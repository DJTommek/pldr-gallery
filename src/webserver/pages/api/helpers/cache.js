const c = require(BASE_DIR_GET('/src/libs/config.js'));
const pathCustom = require(BASE_DIR_GET('/src/libs/path.js'));
const FS = require("fs");
const SHA1 = require('sha1');

module.exports.TYPE = {
	IMAGE: 0,
	FOLDER: 1,
	VIDEO: 2,
};

/**
 * Get path of thumbnail based on type and filename
 *
 * @param {number} type this.TYPE.IMAGE or this.TYPE.FOLDER
 * @param {string} identificator Some identificator of that cache (for example path to file)
 * @param {boolean} check Check if cache in generated path exists. If not, return null
 * @returns {string|null} Full path to thumbnail
 */
module.exports.getPath = function (type, identificator, check = false) {
	let cacheSubpath = '';
	if (type === this.TYPE.IMAGE) {
		cacheSubpath = '/thumbnails/image/';
	} else if (type === this.TYPE.FOLDER) {
		cacheSubpath = '/thumbnails/folder/';
	} else if (type === this.TYPE.VIDEO) {
		cacheSubpath = '/thumbnails/video/';
	} else {
		throw new Error('Unknown type "' + type + '" to get thumbnail path.');
	}
	const fullPath = pathCustom.join(c.cache.path, cacheSubpath, SHA1(identificator)) + '.png';
	if (check === true && FS.existsSync(fullPath) === false) {
		return null;
	}
	return fullPath;
};

/**
 * Load thumbnail and return it's stream
 *
 * @param type
 * @param identificator
 * @returns {ReadStream}
 */
module.exports.getStream = function(type, identificator) {
	const path = this.getPath(type, identificator, true);
	return FS.createReadStream(path);
};

/**
 * Save thumbnail to file
 *
 * @param type
 * @param identificator
 * @param {ReadStream} imageStream
 */
module.exports.saveStream = async function (type, identificator, imageStream) {
	const fullPath = this.getPath(type, identificator);
	return await new Promise(function (resolve, reject) {
		const writeStream = FS.createWriteStream(fullPath);
		writeStream.on('finish', function () {
			resolve();
		});
		writeStream.on('error', reject);
		imageStream.pipe(writeStream);
	});
};
