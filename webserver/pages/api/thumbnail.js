const c = require(BASE_DIR_GET('/libs/config.js'));
const pathCustom = require(BASE_DIR_GET('/libs/path.js'));
const sharp = require('sharp');
const LOG = require(BASE_DIR_GET('/libs/log.js'));

const getItemsHelper = require(__dirname + '/helpers/getItemsFromFolder.js');

module.exports = function (webserver, endpoint) {

	webserver.get(endpoint, function (req, res) {
		res.statusCode = 200;
		if (!res.locals.fullPathFolder) {
			return res.result.setError('Invalid path or you dont have a permission.').end(403);
		}

		getItemsHelper.files(res.locals.path, res.locals.fullPathFolder, res.locals.userPerms).then(function (data) {
			const imagesInFolder = data[0].filter(function(item) {
				return item.isImage;
			});

			// load 4 random images from folder
			if (imagesInFolder.length < 4) {
				return res.result.setError('Not enough images available in this folder.').end(403);
			}
			let randomImages = [];
			while (randomImages.length !== 4) {
				const randomIndex = Math.floor(Math.random() * imagesInFolder.length);
				randomImages.pushUnique(pathCustom.join(c.path, imagesInFolder[randomIndex].path));
			}

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
				res.setHeader("Content-Type", 'image/png');
			}).catch(function (error) {
				LOG.error('Error while generating thumbnail image for folder "": ' + error.message);
				return res.result.setError('Error while generating folder thumbnail image.').end(500);
			});
		});
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
