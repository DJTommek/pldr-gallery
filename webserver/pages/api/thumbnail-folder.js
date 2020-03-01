const c = require(BASE_DIR_GET('/libs/config.js'));
const pathCustom = require(BASE_DIR_GET('/libs/path.js'));
const sharp = require('sharp');
const LOG = require(BASE_DIR_GET('/libs/log.js'));
const FS = require("fs");

const getItemsHelper = require(__dirname + '/helpers/getItemsFromFolder.js');

module.exports = function (webserver, endpoint) {

	webserver.get(endpoint, function (req, res) {
		if (c.thumbnails.folder.enabled !== true) {
			return res.result.setError('Folder thumbnail images are disabled in server config. Check out "config.thumbnails.folder.enabled".').end(403);
		}

		if (!res.locals.fullPathFolder) {
			return res.result.setError('Invalid path or you dont have a permission.').end(403);
		}

		// Use cached file if exists
		const cacheFilePath = pathCustom.join(c.cache.path, '/thumbnails/folder/', req.query.path) + '.png';
		if (c.thumbnails.folder.cache === true && FS.existsSync(cacheFilePath)) {
			res.statusCode = 200;
			res.setHeader("Content-Type", 'image/png');
			res.sendFile(cacheFilePath);
			return;
		}
		// thumbnail is not cached

		getItemsHelper.files(res.locals.path, res.locals.fullPathFolder, res.locals.userPerms).then(function (data) {
			const imagesInFolder = data.items.filter(function (item) {
				return item.isImage;
			});

			if (imagesInFolder.length < c.thumbnails.folder.positions.length) {
				return res.result.setError('Not enough images available in this folder.').end(403);
			}

			// get X images and generate promises for resizing
			let resizePromises = [];
			imagesInFolder.sort(() => .5 - Math.random()).slice(0, c.thumbnails.folder.positions.length).forEach(function(folderItem, index) {
				resizePromises.push(sharp(pathCustom.join(c.path, folderItem.path)).resize({
					width: c.thumbnails.folder.positions[index].width,
					height: c.thumbnails.folder.positions[index].height,
				}).toBuffer());
			});

			// resize all loaded images and use them to build final thumbnail
			Promise.all(resizePromises).then(function (resizedImages) {
				let toComposite = [];
				resizedImages.forEach(function (resizedImage, index) {
					toComposite.push({input: resizedImages[index], gravity: c.thumbnails.folder.positions[index].gravity})
				});
				const thumbnailImage = sharp(c.thumbnails.folder.inputOptions).composite(toComposite);

				// if caching is enabled, save it to file and stream that file
				if (c.thumbnails.folder.cache === true) {
					// @TODO this should stream to both targets, file and response at once. In this case it is slower
					//  for client, because client has to wait, until file is saved on disc and again loaded
					thumbnailImage.toFile(cacheFilePath).then(function() {
						res.sendFile(cacheFilePath);
					}).catch(function (error) {
						LOG.error('Error while saving generated thumbnail to cache path "' + cacheFilePath + '": ' + error.message);
						thumbnailImage.png().pipe(res);
					});
				} else {
					thumbnailImage.png().pipe(res);
				}

				res.statusCode = 200;
				res.setHeader("Content-Type", 'image/png');
			}).catch(function (error) {
				LOG.error('Error while generating thumbnail image for folder "' + res.locals.path + '": ' + error.message);
				return res.result.setError('Error while generating folder thumbnail image.').end(500);
			});
		});
	});
};
