const c = require(BASE_DIR_GET('/src/libs/config.js'));
const pathCustom = require(BASE_DIR_GET('/src/libs/path.js'));
const sharp = require('sharp');
const LOG = require(BASE_DIR_GET('/src/libs/log.js'));
const cacheHelper = require('./helpers/cache');
const perms = require(BASE_DIR_GET('/src/libs/permissions.js'));
const FS = require('fs');
const structureRepository = require('../../../libs/repository/structure');
const HFS = require("../../../libs/helperFileSystem");

module.exports = async function (webserver, endpoint) {

	webserver.get(endpoint, async function (req, res) {
		res.statusCode = 200;
		try {
			if (c.thumbnails.folder.enabled !== true) {
				// return res.result.setError('Folder thumbnail images are disabled in server config. Check out "config.thumbnails.folder.enabled".').end(403);
				return sendTransparentPixel();
			}
			if (!res.locals.fullPathFolder) {
				// return res.result.setError('Invalid path or you dont have a permission.').end(403);
				return sendTransparentPixel();
			}

			const thumbnailPath = preparedThumbnailPath();
			if (thumbnailPath) {
				setHttpHeadersFromConfig();
				res.setHeader('Content-Type', HFS.detectMimeType(thumbnailPath));
				res.sendFile(thumbnailPath);
				return;
			}

			// User has to have full access to checked folder to use cached files. Otherwise he would be able to see thumbnail
			// generated from images, that are not allowed. Possible bad use case:
			// User1 with full access generate thumbnail from images 1, 2, 3, 4 and save it to cache
			// User2 with access to images 1, 2 is able to see thumbnail generated from images 1, 2, 3, 4 because it was cached before
			const canUseCache = perms.test(res.locals.user.getPermissions(), res.locals.path, true);

			const dispositionHeader = 'inline; filename="' + encodeURI(
				'directory thumbnail - ' + res.locals.fullPathFolder.split('/').at(-2) + '.png'
			) + '"';

			// Use cached file if possible
			const cacheFilePath = cacheHelper.getPath(cacheHelper.TYPE.FOLDER, res.locals.path, true);
			if (canUseCache && c.thumbnails.folder.cache === true && cacheFilePath) {
				setHttpHeadersFromConfig();
				res.setHeader('Content-Type', 'image/png');
				res.setHeader('Content-Disposition', dispositionHeader);
				res.startTime('apicache', 'Loading cached thumbnail');
				res.sendFile(cacheFilePath);
				return;
			}

			// load all image files from folder
			res.startTime('apiload', 'Loading random files');
			const randomFiles = await structureRepository.randomFiles(res.locals.path);
			res.endTime('apiload');
			const randomFilesReal = randomFiles.filter(function (item) {
				return item.isImage && perms.test(res.locals.user.getPermissions(), item.path);
			});

			if (randomFilesReal.length < c.thumbnails.folder.positions.length) {
				return sendTransparentPixel();
			}

			// get random X images and generate promises for final composing
			let resizePromises = [];
			randomFilesReal.slice(0, c.thumbnails.folder.positions.length).forEach(function (folderItem, index) {
				resizePromises.push(sharp(pathCustom.join(c.path, folderItem.path)).resize({
					width: c.thumbnails.folder.positions[index].width,
					height: c.thumbnails.folder.positions[index].height,
				}).toBuffer());
			});

			res.startTime('apiresize', 'Resizing images');
			// resize all loaded images and use them to build final thumbnail
			Promise.all(resizePromises).then(function (resizedImages) {
				res.endTime('apiresize');
				res.startTime('apicompose', 'Composing thumbnail');
				let toComposite = [];
				resizedImages.forEach(function (resizedImage, index) {
					toComposite.push({input: resizedImages[index], gravity: c.thumbnails.folder.positions[index].gravity})
				});
				const thumbnailImageStream = sharp(c.thumbnails.folder.inputOptions).composite(toComposite).png();

				setHttpHeadersFromConfig();
				res.setHeader('Content-Type', 'image/png');
				res.setHeader('Content-Disposition', dispositionHeader);
				thumbnailImageStream.pipe(res);

				// if caching is enabled, save it
				if (canUseCache && c.thumbnails.folder.cache === true) {
					cacheHelper.saveStream(cacheHelper.TYPE.FOLDER, res.locals.path, thumbnailImageStream);
				}
			}).catch(function (error) {
				LOG.error('Error while generating thumbnail image for directory "' + res.locals.path + '": ' + error.message);
				return res.result.setError('Error while generating directory thumbnail image.').end(500);
			});
		} catch (error) {
			LOG.error('Error while preparing images for thumbnail image for directory "' + res.locals.path + '": ' + error.message);
			return res.result.setError('Error while preparing images for directory thumbnail image.').end(500);
		}

		function setHttpHeadersFromConfig() {
			c.thumbnails.folder.httpHeaders.forEach(function (header) {
				res.setHeader(header.name, header.value);
			})
		}

		function sendTransparentPixel() {
			const transparentPixelBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII';
			const imgBuffer = Buffer.from(transparentPixelBase64, 'base64');
			res.setHeader('Content-Type', 'image/png');
			res.setHeader('Content-Length', imgBuffer.length);
			res.setHeader('Cache-Control', 'public, max-age=2592000'); // cache for one month
			res.end(imgBuffer);
		}

		/** @returns {string|null} Absolute path of prepared thumbnail or null if no file is available */
		function preparedThumbnailPath() {
			const files = ['thumbnail.png', 'thumbnail.jpg'];
			for (const filename of files) {
				let fullPath = pathCustom.join(res.locals.fullPathFolder, filename);
				if (FS.existsSync(fullPath)) {
					return fullPath;
				}
			}
			return null;
		}
	});

};
