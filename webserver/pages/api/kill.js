const c = require(process.cwd() + '/libs/config.js');
const FS = require('fs');
const HFS = require(process.cwd() + '/libs/helperFileSystem.js');
const LOG = require(process.cwd() + '/libs/log.js');

module.exports = function (webserver, endpoint) {
	/**
	 * Kill server
	 *
	 * @returns JSON
	 */
	webserver.get(endpoint, function (req, res) {
		res.setHeader("Content-Type", "application/json");

		if (req.query.password !== c.security.killPassword) {
			res.result.setError('Wrong password').end();
			return;
		}
		res.result.setResult(null, 'pldrGallery is going to kill in 2 seconds.').end();
		LOG.head('(Web) Server is going to kill');
		setTimeout(function () {
			process.exit();
		}, 2000);
	});
};
