const FS = require('fs');
const CONFIG = require(BASE_DIR_GET('/src/libs/config.js'));
const LOG = require(BASE_DIR_GET('/src/libs/log.js'));

module.exports = function (webserver, baseEndpoint) {
	/**
	 * Google logout
	 * - remove cookie from the server (cant be used anymore)
	 * - request browser to remove it from browser
	 */
	webserver.get(baseEndpoint, function (req, res) {
		try {
			if (!res.locals.user) {
				return; // Already logged out
			}
			const token = req.cookies[CONFIG.http.login.name];
			FS.unlinkSync(CONFIG.http.login.tokensPath + token + '.json');
		} catch (error) {
			LOG.error('Web logout error: ' + error.message);
		} finally {
			// Even if some error occured, cookie will be deleted (send request to browser to remove cookie)
			res.clearCookie(CONFIG.http.login.name);
			res.redirect('/');
		}
	});
};
