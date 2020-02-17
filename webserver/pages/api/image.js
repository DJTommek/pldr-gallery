const c = require(BASE_DIR_GET('/libs/config.js'));
const FS = require('fs');
const pathCustom = require(BASE_DIR_GET('/libs/path.js'));
const sharp = require('sharp');

module.exports = function (webserver, endpoint) {

	require(__dirname + '/helpers/getMediaType.js')(webserver, endpoint);

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
			const extensionData = (new FileExtensionMapper).getImage(pathCustom.extname(res.locals.fullPathFile));
			if (!extensionData) {
				throw new Error('Soubor nemá příponu obrázku.');
			}
			let imageStream = FS.createReadStream(res.locals.fullPathFile);
			if ((req.cookies['pmg-compress'] === 'true' && req.query.compress !== 'false') || req.query.compress === 'true') {
				let compressData = Object.assign({}, c.compress);

				// Override default settings with custom parameters
				if (req.query.fit && req.query.width && req.query.height) {

					compressData.width = parseInt(req.query.width);
					if (compressData.width <= 0) {
						throw new Error('Wrong "width" parameter.');
					}

					compressData.height = parseInt(req.query.height);
					if (req.query.height <= 0) {
						throw new Error('Wrong "height" parameter.');
					}

					compressData.fit = req.query.fit;
					if (['cover', 'contain', 'fill', 'inside', 'outside'].inArray(compressData.fit) === false) {
						throw new Error('Wrong "fit" parameter.');
					}
				}

				imageStream = imageStream.pipe(sharp().resize(compressData));
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
