const c = require(BASE_DIR_GET('/src/libs/config.js'));
const LOG = require(BASE_DIR_GET('/src/libs/log.js'));

module.exports = function (webserver, endpoint) {

	/**
	 * Kill server
	 *
	 * @returns JSON
	 */
	webserver.get(endpoint, function (req, res) {

		if (c.security.killPassword === null) {
			res.result.setError('Killing is disabled in config.').end(400);
			return;
		}
		if (req.query.password !== c.security.killPassword) {
			res.result.setError('Wrong password').end(400);
			return;
		}
		res.result.setResult(null, 'pldrGallery is going to kill.').end(200);
		LOG.info('(Web) Server is stopping...');
		process.kill(process.pid, 'SIGINT');
	});
};
