const pathCustom = require(BASE_DIR_GET('/src/libs/path.js'));
const LOG = require(BASE_DIR_GET('/src/libs/log.js'));
const perms = require(BASE_DIR_GET('/src/libs/permissions.js'));

module.exports = function (webserver, endpoint) {

	/**
	 * Check and/or update passwords
	 * If no parameter is set, list of passwords and permissions to these passwords is returned
	 * If parameter "password" is set and valid, save it to the cookie and returns permissions to this passwords
	 *
	 * @requires password (optional)
	 * @returns JSON list of permissions
	 */
	webserver.get(endpoint, function (req, res) {
		res.setHeader("Content-Type", "application/json");
		res.statusCode = 200;
		let cookiePasswords = req.cookies['pmg-passwords'];
		try {
			// If no password parameter is set, return list of all passwords
			if (!req.query.password) {
				let passwordPerms = [];
				if (cookiePasswords) {
					cookiePasswords.split(',').forEach(function (password) {
						const passwordObject = perms.getPassword(password);
						if (passwordObject) {
							passwordPerms.push({
								password: passwordObject.password,
								permissions: passwordObject.permissions
							});
						} else {
							// Probably just invalid password in cookie
						}
					});
				}
				return res.result.setResult(passwordPerms, 'List of saved passwords.').end();
			}
		} catch (error) {
			let errorMsg = 'Error while loading list of saved passwords: ' + error.message;
			LOG.error(errorMsg);
			return res.result.setError(errorMsg).end();
		}

		try {
			// Passsword parameter is set. Check, if there are any permission to this cookie
			let passwordObject = perms.getPassword(req.query.password);
			if (!passwordObject) {
				throw new Error('invalid password.');
			}
			// Password is valid, save it into cookie (or create it if not set before)
			if (cookiePasswords) {
				let passwordsCookie = cookiePasswords.split(',');
				if (passwordsCookie.indexOf(req.query.password) === -1) { // push to cookie only if not already pushed before
					passwordsCookie.push(req.query.password);
					res.cookie('pmg-passwords', passwordsCookie.join(','), {expires: new Date(253402300000000)});
				}
			} else {
				res.cookie('pmg-passwords', req.query.password, {expires: new Date(253402300000000)});
			}
			if (req.xhr || req.query.redirect === 'false') {
				// return list of permissions to this password
				res.result.setResult({
					password: req.query.password,
					permissions: passwordObject
				}, 'Password "' + req.query.password + '" is valid.').end();
				return;
			}
			// automatic redirect to the folder
			let redirectFolder = passwordObject.getPermissions()[0];
			if (redirectFolder.slice(-1) !== '/') {
				// this is not folder, redirect to dirname of this path
				redirectFolder = pathCustom.dirname(redirectFolder);
			}
			res.cookie('pmg-redirect', redirectFolder, {expires: new Date(253402300000000)});
			res.redirect('/');
		} catch (error) {
			res.result.setError('Error while checking password: ' + error.message).end();
		}
	});
};
