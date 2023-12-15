const FS = require('fs');
const LOG = require(BASE_DIR_GET('/src/libs/log.js'));
const HFS = require(BASE_DIR_GET('/src/libs/helperFileSystem.js'));
module.exports = function (webserver, endpoint) {

	/**
	 * Force download file instead custom headers for image, video etc.
	 *
	 * @returns streamed file if ok
	 * @returns JSON if error
	 */
	webserver.get(endpoint, function (req, res) {
		res.statusCode = 200;
		try {
			if (!res.locals.fullPathFile) {
				throw new Error('invalid or missing path');
			}

			const mimeType = HFS.detectMimeType(res.locals.fullPathFile);
			if (mimeType) {
				res.setHeader('Content-Type', mimeType);
			}

			res.setHeader('Content-Disposition', 'attachment; filename="' + encodeURI(res.locals.fullPathFile.split('/').pop()) + '"');
			LOG.info('(Web) Streaming file to download: ' + res.locals.fullPathFile);
			return FS.createReadStream(res.locals.fullPathFile).pipe(res);
		} catch (error) {
			res.statusCode = 404;
			res.result.setError('Error while loading file: ' + error.message).end();
		}
	});
};
