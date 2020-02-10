const c = require(process.cwd() + '/libs/config.js');
const FS = require('fs');
const HFS = require(process.cwd() + '/libs/helperFileSystem.js');
const LOG = require(process.cwd() + '/libs/log.js');

module.exports = function (webserver, endpoint) {

	/**
	 * Save reports (errors, feedback, etc)
	 *
	 * @returns JSON
	 */
	webserver.post(endpoint, function (req, res) {
		res.setHeader("Content-Type", "application/json");
		res.statusCode = 200;
		let msg = '(Report) User "' + (res.locals.user ? res.locals.user : 'x') + '" is reporting ';
		if (req.body.type && req.body.type.match(/^[a-zA-Z0-9_\-.]{1,20}$/) && req.body.raw) {
			switch (req.body.type) {
				case 'javascript':
					LOG.error(msg += 'javascript error:\n' + req.body.raw);
					break;
				default:
					LOG.debug(msg += 'type="' + req.body.type + '":\n"' + req.body.raw + '".');
					break;
			}
			res.result.setResult(null, 'Report saved').end();
		} else {
			res.result.setError('Invalid "type" or "raw" POST data').end();
		}
	});
};
