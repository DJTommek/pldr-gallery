const c = require(process.cwd() + '/libs/config.js');
const FS = require('fs');
const HFS = require(process.cwd() + '/libs/helperFileSystem.js');
const LOG = require(process.cwd() + '/libs/log.js');

module.exports = function(webserver, endpoint){
	/**
	 * Show uptime data
	 *
	 * @returns JSON
	 */
	webserver.get(endpoint, function (req, res) {
		res.setHeader("Content-Type", "application/json");
		res.statusCode = 200;
		const diff = (new Date() - c.start);
		const result = {
			start: c.start.human(),
			uptime: {
				milliseconds: diff,
				human: msToHuman(diff)
			}
		};
		res.result.setResult(result).end();
	});
};
