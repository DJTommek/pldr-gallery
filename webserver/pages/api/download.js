const FS = require('fs');
const LOG = require(BASE_DIR_GET('/libs/log.js'));
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

			res.setHeader('Content-Disposition', 'inline; filename="' + encodeURI(res.locals.fullPathFile.split('/').pop()) + '"');
			LOG.info('(Web) Streaming file to download: ' + res.locals.fullPathFile);
			return FS.createReadStream(res.locals.fullPathFile).pipe(res);
		} catch (error) {
			res.statusCode = 404;
			res.result.setError('Error while loading file: ' + error.message).end();
		}
	});
};
