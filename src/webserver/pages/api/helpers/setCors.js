const HFS = require(BASE_DIR_GET('/src/libs/helperFileSystem.js'));
const LOG = require(BASE_DIR_GET('/src/libs/log.js'));
module.exports = function (webserver, endpointPath) {

	/**
	 * Force set media type. If unable to detect, return error to HTTP
	 *
	 * @return next()
	 */
	webserver.get(endpointPath, function (req, res, next) {
		res.setHeader('Access-Control-Allow-Origin', '*');
		next();
	});
};
