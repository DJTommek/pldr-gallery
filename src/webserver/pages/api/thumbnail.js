const c = require(BASE_DIR_GET('/src/libs/config.js'));
const pathCustom = require(BASE_DIR_GET('/src/libs/path.js'));
const cacheHelper = require('./helpers/cache');
const perms = require(BASE_DIR_GET('/src/libs/permissions.js'));
const FS = require('fs');
const HFS = require("../../../libs/helperFileSystem");
const LOG = require(BASE_DIR_GET('/src/libs/log.js'));

module.exports = async function (webserver, endpoint) {
	webserver.get(endpoint, async function (req, res) {
		res.statusCode = 200;
		try {
			if (!res.locals.pathItem) {
				// return res.result.setError('Invalid path or you dont have a permission.').end(403);
				return sendTransparentPixel();
			}

			/**
			 * @var {FolderItem|FileItem}
			 */
			const pathItem = res.locals.pathItem;

			if (
				(pathItem.isFolder && c.thumbnails.folder.enabled === false)
				|| (pathItem.isImage && c.thumbnails.image.enabled === false)
				|| (pathItem.isVideo && c.thumbnails.video.enabled === false)
			) {
				return sendTransparentPixel();
			}

			// Check if there is prepared thumbnail right in directory and if so, serve that instead of cached
			// pre-generated thumbnail.
			if (pathItem.isFolder) {
				const files = ['thumbnail.png', 'thumbnail.jpg'];
				for (const filename of files) {
					let customThumbnailFullPath = pathCustom.join(res.locals.fullPathFolder, filename);
					if (FS.existsSync(customThumbnailFullPath)) {
						setHttpHeadersFromConfig();
						res.setHeader('Content-Type', HFS.detectMimeType(customThumbnailFullPath));
						res.sendFile(customThumbnailFullPath);
						return;
					}
				}
			}

			// User has to have full access to checked folder to use cached files. Otherwise he would be able to see thumbnail
			// generated from images, that are not allowed. Possible bad use case:
			// User1 with full access generate thumbnail from images 1, 2, 3, 4 and save it to cache
			// User2 with access to images 1, 2 is able to see thumbnail generated from images 1, 2, 3, 4 because it was cached before
			const canUseCache = perms.test(res.locals.user.getPermissions(), pathItem.path, true);

			if (canUseCache === false) {
				return sendTransparentPixel();
			}

			const cacheItemType = cacheHelper.getTypeFromItem(pathItem);
			if (cacheItemType === null) {
				return sendTransparentPixel()
			}

			const cacheFilePath = cacheHelper.getPath(cacheItemType, res.locals.path, true);
			if (cacheFilePath === null) {
				return sendTransparentPixel();
			}

			const dispositionHeader = 'inline; filename="' + encodeURI(
				pathItem.basename + '.thumbnail.' + c.thumbnails.extension
			) + '"';

			setHttpHeadersFromConfig();
			res.setHeader('Content-Type', 'image/' + c.thumbnails.extension);
			res.setHeader('Content-Disposition', dispositionHeader);
			res.sendFile(cacheFilePath);
		} catch (error) {
			LOG.error('Error while providing thumbnail for "' + res.locals.path + '": ' + error.message);
			return res.result.setError('Error while providing thumbnail image, try again later.').end(500);
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
	});
};
