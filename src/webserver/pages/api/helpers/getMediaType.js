const HFS = require(BASE_DIR_GET('/src/libs/helperFileSystem.js'));
const LOG = require(BASE_DIR_GET('/src/libs/log.js'));
module.exports = function (webserver, endpointPath) {

	/**
	 * Force set media type. If unable to detect, return error to HTTP
	 *
	 * @return next()
	 */
	webserver.get(endpointPath, function (req, res, next) {
		if (res.locals.fullPathFile) {
			const mimeType = HFS.detectMimeType(res.locals.fullPathFile);
			if (mimeType) {
				res.locals.mediaType = mimeType;
			} else {
				LOG.error('Unable to detect media type for file "' + res.locals.fullPathFile + '".');
				res.result.setError('Unable to detect media type for file "' + res.locals.path + '".').end(500);
			}
		}
		next();
	});
};
