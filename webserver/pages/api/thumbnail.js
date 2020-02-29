const c = require(BASE_DIR_GET('/libs/config.js'));
const FS = require('fs');
const pathCustom = require(BASE_DIR_GET('/libs/path.js'));
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
			if (!res.locals.fullPathFolder) {
				throw new Error('Invalid path or you dont have a permission.');
			}
			// load 4 random images from folder
			FS.readdir(res.locals.fullPathFolder, function (error, imagesInFolder) {
				if (imagesInFolder.length < 4) {
					res.result.setError('Not enough images available in this folder').end();
					return;
				}
				let randomImages = [];
				while (randomImages.length !== 4) {
					const randomIndex = Math.floor(Math.random() * imagesInFolder.length);
					randomImages.pushUnique(pathCustom.join(res.locals.fullPathFolder, imagesInFolder[randomIndex]));
				}
				console.log(error);
				console.log(randomImages);
				res.setHeader("Content-Type", 'image/png');

				Promise.all([
					sharp(randomImages[0]).resize({width: 100, height: 100,}).toBuffer(),
					sharp(randomImages[1]).resize({width: 100, height: 100,}).toBuffer(),
					sharp(randomImages[2]).resize({width: 100, height: 100,}).toBuffer(),
					sharp(randomImages[3]).resize({width: 100, height: 100,}).toBuffer(),
				]).then(function (resizedImages) {
					sharp({
						create: {
							width: 200,
							height: 200,
							channels: 3,
							background: {r: 99, g: 99, b: 99}
						}
					})
						.composite(
							[
								// {input: sharp(randomImages[0]).resize({width: 50, height: 50}).raw(), gravity: 'southeast'},
								{input: resizedImages[0], gravity: 'northwest'},
								{input: resizedImages[1], gravity: 'northeast'},
								{input: resizedImages[2], gravity: 'southwest'},
								{input: resizedImages[3], gravity: 'southeast'},
							]
						)
						.png()
						.pipe(res);
					console.log(res.result.getDuration(true));
				});
			});
		} catch (error) {
			res.statusCode = 404;
			let fontSize = 40;
			let textBuffer = new Buffer.from(
				'<svg height="' + (fontSize) + '" width="700">' +
				'  <text x="50%" y="30" dominant-baseline="hanging" text-anchor="middle" font-size="' + fontSize + '" fill="#fff">' + error.message + '</text>' +
				'</svg>'
			);

			sharp({
				create: {
					width: 700,
					height: 100,
					channels: 4,
					background: {r: 220, g: 53, b: 69,}
				}
			}).composite(
				[
					{input: textBuffer}
				]
			).png().pipe(res);
		}
	});
};

function getResizeParams(req) {
	// resizing is disabled in config
	if (c.compress.enabled !== true) {
		return false;
	}
	// custom resize settings
	if (req.query.fit && req.query.width && req.query.height) {
		let compressData = Object.assign({}, c.compress);

		compressData.width = parseInt(req.query.width);
		if (compressData.width <= 50) {
			throw new Error('Wrong "width" parameter.');
		}

		compressData.height = parseInt(req.query.height);
		if (req.query.height <= 50) {
			throw new Error('Wrong "height" parameter.');
		}

		compressData.fit = req.query.fit;
		if (['cover', 'contain', 'fill', 'inside', 'outside'].inArray(compressData.fit) === false) {
			throw new Error('Wrong "fit" parameter.');
		}
		return compressData;
	}

	// default resize settings (compressing)
	if ((req.cookies['pmg-compress'] === 'true' && req.query.compress !== 'false') || req.query.compress === 'true') {
		return c.compress;
	}
	return false;
}
