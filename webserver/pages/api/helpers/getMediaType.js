const pathCustom = require(process.cwd() + '/libs/path.js');
const LOG = require(process.cwd() + '/libs/log.js');
module.exports = function (webserver, endpointPath) {

	/**
	 * Set media type
	 *
	 * @return next()
	 */
	webserver.get(endpointPath, function (req, res, next) {
		if (res.locals.fullPathFile) {
			const ext = pathCustom.extname(res.locals.fullPathFile);
			const extData = (new FileExtensionMapper).get(ext);
			if (extData && extData.mediaType) {
				res.locals.mediaType = extData.mediaType;
			} else {
				const error = 'File extension "' + ext + '" has no defined media type.';
				LOG.error(error);
				res.result.setError(error).end(500);
			}
		}
		next();
	});
};
