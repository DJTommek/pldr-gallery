const c = require(BASE_DIR_GET('/src/libs/config.js'));
const FS = require('fs');
const sharp = require('sharp');
const {pipeline} = require("node:stream/promises");
const LOG = require('../../../libs/log.js');

module.exports = function (webserver, endpoint) {
	/**
	 * Stream image.
	 * Image can be compressed via cookie. This can be overriden via GET compress=true or false
	 *
	 * @returns image stream (in case of error, streamed image with error text)
	 */
	webserver.get(endpoint, async function (req, res) {
		res.statusCode = 200;

		try {
			/** @var {FileItem|null} */
			const fileItem = res.locals.pathItem;
			if (fileItem?.isImage !== true) {
				return res.result.setError('Invalid path or you dont have a permission.').end(403);
			}

			let imageStream = FS.createReadStream(res.locals.fullPathFile);
			const compressData = getResizeParams(req);

			if (compressData === false) { // Compression is disabled, stream file directly to response
				const mimeType = fileItem.mimeType;
				if (mimeType) {
					res.setHeader('Content-Type', mimeType);
				}
				return await pipeline(imageStream, res);
			}

			const imageCompressedStream = imageStream.pipe(sharp().withMetadata().resize(compressData));

			try {
				// Check if image is valid
				// @link https://github.com/lovell/sharp/issues/1298#issuecomment-405900215
				await imageCompressedStream.stats();
			} catch (error) {
				LOG.error('Error while providing compressed image "' + res.locals.path + '", file is corrupted: ' + error.message);
				return res.result.setError('Error while providing compressed image, file is corrupted.').end(500);
			}

			// @TODO detect MIME type of compressed image and set it as HTTP header 'Content-Type'.
			await pipeline(imageCompressedStream, res);
		} catch (error) {
			LOG.error('Error while providing image "' + res.locals.path + '": ' + error.message);
			return res.result.setError('Error while providing image, try again later.').end(500);
		}
	});
};

function getResizeParams(req) {
	let compressData = Object.assign({}, c.compress);
	// thumbnail is requested
	if (req.query.type === 'thumbnail') {
		if (c.thumbnails.image.enabled === false) {
			throw new Error('Image thumbnails are disabled.');
		}
		compressData.width = c.thumbnails.width;
		compressData.height = c.thumbnails.height;
		compressData.fit = c.thumbnails.image.fit;
		return compressData;
	}
	// compressing via resizing is disabled in config
	if (c.compress.enabled !== true) {
		return false;
	}
	// user settings has enabled compress resizing
	if ((req.cookies['pmg-compress'] === 'true' && req.query.compress !== 'false') || req.query.compress === 'true') {
		return c.compress;
	}
	return false;
}
