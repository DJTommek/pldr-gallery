const c = require(BASE_DIR_GET('/src/libs/config.js'));
const pathCustom = require(BASE_DIR_GET('/src/libs/path.js'));
const FS = require('fs');
const path = require('path');
const SHA1 = require('sha1');

module.exports.TYPE = {
	IMAGE: 0,
	FOLDER: 1,
	VIDEO: 2,
};

/**
 * @param {FolderItem|FileItem} pathItem
 * @return {number|null}
 */
module.exports.getTypeFromItem = function (pathItem) {
	if (pathItem.isImage) {
		return module.exports.TYPE.IMAGE
	} else if (pathItem.isVideo) {
		return module.exports.TYPE.VIDEO
	} else if (pathItem.isFolder) {
		return module.exports.TYPE.FOLDER
	} else {
		return null;
	}
}

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

	const fileHashId = SHA1(identificator);
	const pathParts = [
		c.cache.path,
		cacheSubpath,
		fileHashId.substring(0, 2),
		fileHashId.substring(2, 4),
		fileHashId.substring(4, 6),
		fileHashId + '.jpg',
	];

	const fullPath = pathCustom.join(...pathParts);
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
module.exports.getStream = function (type, identificator) {
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
	FS.mkdirSync(path.dirname(fullPath), {recursive: true});
	return await new Promise(function (resolve, reject) {
		const writeStream = FS.createWriteStream(fullPath);
		writeStream.on('finish', function () {
			resolve();
		});
		writeStream.on('error', reject);
		imageStream.on('error', reject);
		imageStream.pipe(writeStream);
	});
};
