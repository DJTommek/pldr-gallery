const c = require(BASE_DIR_GET('/libs/config.js'));
const pathCustom = require(BASE_DIR_GET('/libs/path.js'));
const sharp = require('sharp');
const LOG = require(BASE_DIR_GET('/libs/log.js'));

const getItemsHelper = require(__dirname + '/helpers/getItemsFromFolder.js');

module.exports = function (webserver, endpoint) {

	webserver.get(endpoint, function (req, res) {
		if (!res.locals.fullPathFolder) {
			return res.result.setError('Invalid path or you dont have a permission.').end(403);
		}

		getItemsHelper.files(res.locals.path, res.locals.fullPathFolder, res.locals.userPerms).then(function (data) {
			const imagesInFolder = data.items.filter(function (item) {
				return item.isImage;
			});

			if (imagesInFolder.length < c.thumbnails.folder.positions.length) {
				return res.result.setError('Not enough images available in this folder.').end(403);
			}

			// get x random images from folder
			let randomImages = [];
			while (randomImages.length !== c.thumbnails.folder.positions.length) {
				const randomIndex = Math.floor(Math.random() * imagesInFolder.length);
				randomImages.pushUnique(pathCustom.join(c.path, imagesInFolder[randomIndex].path));
			}

			let resizePromises = [];
			randomImages.forEach(function (path, index) {
				resizePromises.push(sharp(path).resize({
					width: c.thumbnails.folder.positions[index].width,
					height: c.thumbnails.folder.positions[index].height,
				}).toBuffer());
			});

			Promise.all(resizePromises).then(function (resizedImages) {
				let toComposite = [];
				resizedImages.forEach(function (resizedImage, index) {
					toComposite.push({input: resizedImages[index], gravity: c.thumbnails.folder.positions[index].gravity})
				});
				sharp(c.thumbnails.folder.inputOptions)
					.composite(toComposite)
					.png()
					.pipe(res);
				res.statusCode = 200;
				res.setHeader("Content-Type", 'image/png');
			}).catch(function (error) {
				LOG.error('Error while generating thumbnail image for folder "' + res.locals.path + '": ' + error.message);
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
