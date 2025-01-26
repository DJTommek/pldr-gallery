const c = require(BASE_DIR_GET('/src/libs/config.js'));

module.exports = function (webserver, endpoint) {

	/**
	 * Show uptime data
	 *
	 * @returns JSON
	 */
	webserver.get(endpoint, function (req, res) {
		const diff = (new Date() - c.start);
		const result = {
			start: c.start.human(),
			uptime: {
				milliseconds: diff,
				human: msToHuman(diff)
			}
		};
		res.result.setResult(result).end(200);
	});
};
