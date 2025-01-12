const c = require(BASE_DIR_GET('/src/libs/config.js'));
const FS = require('fs');
const sharp = require('sharp');
const cacheHelper = require('./helpers/cache');

module.exports = function (webserver, endpoint) {

	require(__dirname + '/helpers/getMediaType.js')(webserver, endpoint);

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
			const fileItem = res.locals.pathItemSimple;

			if (fileItem === null) {
				throw new Error('Invalid path or you dont have a permission.');
			}
			if (fileItem.isImage === false) {
				throw new Error('Requested path is not an image.');
			}

			let imageStream = FS.createReadStream(res.locals.fullPathFile);
			const compressData = getResizeParams(req);

			// if compression is enabled, compress first
			if (compressData !== false) {
				imageStream = imageStream.pipe(sharp().withMetadata().resize(compressData));
			}

			if (res.finished === false) { // in case of timeout, response was already finished
				res.setHeader('Content-Type', res.locals.mediaType);
				res.setHeader('Content-Disposition', 'inline; filename="' + encodeURI(fileItem.basename) + '"');
				imageStream.pipe(res);
			}
		} catch (error) {
			res.statusCode = 404;
			const height = c.thumbnails.height;
			const width = c.thumbnails.width;

			// @TODO resolve text overflow
			let textBuffer = new Buffer.from(`
<svg height="${width}" width="${height}" viewBox="0 0 ${height} ${width}">
  <text x="50%" y="50%" text-anchor="middle" dy="0.25em" fill="#000">${error.message}</text>
</svg>
			`);

			sharp({
				create: {
					width: width,
					height: height,
					channels: 4,
					background: {r: 220, g: 53, b: 69}
				}
			}).composite([{input: textBuffer}]).png().pipe(res);
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
