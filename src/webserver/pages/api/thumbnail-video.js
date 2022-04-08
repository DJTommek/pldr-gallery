const c = require(BASE_DIR_GET('/src/libs/config.js'));
const pathCustom = require(BASE_DIR_GET('/src/libs/path.js'));
const LOG = require(BASE_DIR_GET('/src/libs/log.js'));
const cacheHelper = require('./helpers/cache');
const FS = require('fs');
const ffmpeg = require('fluent-ffmpeg');

module.exports = async function (webserver, endpoint) {

	webserver.get(endpoint, async function (req, res) {
		res.statusCode = 200;
		if (c.thumbnails.video.enabled === false) {
			return sendTransparentPixel();
		}

		if (!res.locals.fullPathFile) {
			return sendTransparentPixel();
		}

		const extensionData = FileExtensionMapperInstance.getVideo(pathCustom.extname(res.locals.fullPathFile));
		if (!extensionData) { // File is not video
			return sendTransparentPixel();
		}

		const dispositionHeader = 'inline; filename="' + encodeURI(
			'thumbnail - ' + res.locals.fullPathFile.split('/').pop() + '.png'
		) + '"';

		const cacheFilePath = cacheHelper.getPath(cacheHelper.TYPE.VIDEO, res.locals.path);
		if (sendCachedFile(cacheFilePath) === false) {
			const pathSplit = cacheFilePath.split('/');
			const cacheFileName = pathSplit.pop()
			const cacheDir = pathSplit.join('/')

			res.startTime('apigeneratevideothumbnail', 'Generate thumbnail image for video');
			const errorPrefix = 'Unable to generate thumbnail for video "' + res.locals.fullPathFile + '": ';
			let stderrLines = [];
			ffmpeg(res.locals.fullPathFile)
				.screenshots({
					count: 1, // 1 = thumbnail from middle of video
					folder: cacheDir,
					filename: cacheFileName,
					size: c.thumbnails.width + 'x' + c.thumbnails.height,
				})
				.autopad()
				.on('error', function (error) {
					sendTransparentPixel();
					if (error.message.includes('moov atom not found')) {
						LOG.warning(errorPrefix + '"moov atom not found". File seems to be corrupted, is it still playable?');
					} else {
						LOG.error(errorPrefix + error);
					}
				})
				.on('stderr', function (stderrLine) {
					stderrLines.push(stderrLine);
				})
				.on('end', function () {
					res.endTime('apigeneratevideothumbnail');
					if (sendCachedFile(cacheFilePath) === false) {
						sendTransparentPixel();
						LOG.warning(errorPrefix + 'thumbnail file was not created but no errors was thrown. Check stderr lines for more info: ' + stderrLines.join('\n'));
					}
				});
		}

		function setHttpHeadersFromConfig() {
			c.thumbnails.video.httpHeaders.forEach(function (header) {
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

		/**
		 * Try to send cached file thumbnail as HTTP response
		 *
		 * @param {string} cacheFilePath Absolute path where cache is/will be saved
		 * @return {boolean} true if cached file exists and was sent
		 */
		function sendCachedFile(cacheFilePath) {
			if (FS.existsSync(cacheFilePath)) {
				setHttpHeadersFromConfig();
				res.setHeader('Content-Type', 'image/png');
				res.setHeader('Content-Disposition', dispositionHeader);
				res.sendFile(cacheFilePath);
				return true;
			} else {
				return false;
			}
		}
	});
};
