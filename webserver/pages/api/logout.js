const c = require(process.cwd() + '/libs/config.js');
const FS = require('fs');
const HFS = require(process.cwd() + '/libs/helperFileSystem.js');
const LOG = require(process.cwd() + '/libs/log.js');

module.exports = function (webserver, endpoint) {
	/**
	 * Google logout
	 * - remove cookie from the server (cant be used anymore)
	 * - request browser to remove it from browser
	 *
	 * @returns JSON if ajax
	 * @returns redirect otherwise
	 */
	webserver.get(endpoint, function (req, res) {
		res.setHeader("Content-Type", "application/json");
		res.statusCode = 200;
		try {
			if (!res.locals.user) { // is logged (it means cookie is valid)
				throw new Error('Not logged in.');
			}
			let token = req.cookies[c.http.login.name];
			try {
				// remove cookie from server file
				FS.unlinkSync(c.http.login.tokensPath + token + '.txt');
			} catch (error) {
				LOG.error('Cant delete token "' + token + '", error: ' + error);
				throw new Error('Cant delete token. More info in log.');
			}
			res.result.setResult('Cookie was deleted');
		} catch (error) {
			res.result.setError(error.message || error);
		}
		res.clearCookie(c.http.login.name); // send request to browser to remove cookie
		res.result.end();
	});
};
