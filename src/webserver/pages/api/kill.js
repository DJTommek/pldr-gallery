const c = require(BASE_DIR_GET('/src/libs/config.js'));
const LOG = require(BASE_DIR_GET('/src/libs/log.js'));

module.exports = function (webserver, endpoint) {

	/**
	 * Kill server
	 *
	 * @returns JSON
	 */
	webserver.get(endpoint, function (req, res) {
		res.setHeader("Content-Type", "application/json");

		if (c.security.killPassword === null) {
			res.result.setError('Killing is disabled in config.').end();
			return;
		}
		if (req.query.password !== c.security.killPassword) {
			res.result.setError('Wrong password').end();
			return;
		}
		res.result.setResult(null, 'pldrGallery is going to kill.').end();
		LOG.info('(Web) Server is stopping...');
		process.kill(process.pid, 'SIGINT');
	});
};
