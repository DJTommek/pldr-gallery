const c = require(process.cwd() + '/libs/config.js');
const FS = require('fs');
const HFS = require(process.cwd() + '/libs/helperFileSystem.js');
const LOG = require(process.cwd() + '/libs/log.js');
const sharp = require('sharp');

module.exports = function (webserver, endpoint) {
	/**
	 * Stream image.
	 * Image can be compressed via cookie. This can be overriden via GET compress=true or false
	 *
	 * @returns image stream (in case of error, streamed image with error text)
	 */
	webserver.get(endpoint, function (req, res) {
		res.statusCode = 200;
		try {
			if (!res.locals.fullPathFile) {
				throw new Error('Neplatná cesta nebo nemáš právo');
			}
			const extensionData = (new FileExtensionMapper).getImage(HFS.extname(res.locals.fullPathFile));
			if (!extensionData) {
				throw new Error('Soubor nemá příponu obrázku.');
			}
			let imageStream = FS.createReadStream(res.locals.fullPathFile);
			if ((req.cookies['pmg-compress'] === 'true' && req.query.compress !== 'false') || req.query.compress === 'true') {
				imageStream = imageStream.pipe(sharp().resize(c.compress));
			}

			res.setHeader("Content-Type", res.locals.mediaType);

			return imageStream.pipe(res);
		} catch (error) {
			res.statusCode = 404;
			let fontSize = 40;
			let textBuffer = new Buffer.from(
				'<svg height="' + (fontSize) + '" width="700">' +
				'  <text x="50%" y="30" dominant-baseline="hanging" text-anchor="middle" font-size="' + fontSize + '" fill="#fff">Chyba: ' + error.message + '</text>' +
				'</svg>'
			);

			sharp({
				create: {
					width: 700,
					height: 100,
					channels: 4,
					background: {r: 220, g: 53, b: 69,}
				}
			}).composite([{input: textBuffer}]).png().pipe(res);
		}
	});
};
