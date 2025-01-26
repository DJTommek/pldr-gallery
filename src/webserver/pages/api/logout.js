const c = require(BASE_DIR_GET('/src/libs/config.js'));
const FS = require('fs');
const LOG = require(BASE_DIR_GET('/src/libs/log.js'));

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
		try {
			if (!res.locals.user.email) { // is logged (it means cookie is valid)
				throw new Error('Not logged in.');
			}
			let token = req.cookies[c.http.login.name];
			try {
				// remove cookie from server file
				FS.unlinkSync(c.http.login.tokensPath + token + '.json');
			} catch (error) {
				LOG.error('Cant delete token "' + token + '", error: ' + error);
				throw new Error('Cant delete token, error was saved');
			}
			res.result.setResult('Cookie was deleted');
		} catch (error) {
			res.result.setError('Logout unsuccessfull: ' + error.message);
		}
		// Even if some error occured, cookie will be deleted (send request to browser to remove cookie)
		res.clearCookie(c.http.login.name);
		res.result.end(200);
	});
};
