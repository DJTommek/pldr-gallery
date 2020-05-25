require(BASE_DIR_GET('/src/webserver/private/js/functions.js'));
const c = require(BASE_DIR_GET('/src/libs/config.js'));
const LOG = require(BASE_DIR_GET('/src/libs/log.js'));

const FS = require('fs');
const PATH = require('path');
const HFS = require(BASE_DIR_GET('/src/libs/helperFileSystem.js'));
const pathCustom = require(BASE_DIR_GET('/src/libs/path.js'));
const perms = require(BASE_DIR_GET('/src/libs/permissions.js'));

module.exports = function (webserver, baseEndpoint) {

	const endpoint = baseEndpoint + '/[a-z-]+'

	/**
	 * API middleware
	 * Init response timeout
	 *
	 * @returns next()
	 */
	webserver.get(endpoint, async function (req, res, next) {
		res.setTimeout(c.http.timeout, function () {
			LOG.error('(Web) Connection timeout for ' + req.path);
			res.result.setError('<b>Nastala chyba</b>, zpracování požadavku trvalo serveru příliš dlouho.<br>Zkus to za chvíli znovu případně kontaktuj admina.').end(408);
		});
		next();
	});

	/**
	 * API middleware
	 * Load user permissions
	 *
	 * @returns next()
	 */
	webserver.get(endpoint, async function (req, res, next) {
		try {
			let token = req.cookies[c.http.login.name];
			// cookie dont exists or is invalid

			if (!token || !token.match("^[a-f0-9]{40}$")) {
				throw new Error('Musis se <a href="/login">prihlasit</a>.');
			}
			let cookieFilePath = c.http.login.tokensPath + token + '.json';
			// check for cookie on the server filesystem
			if (!FS.existsSync(cookieFilePath)) {
				throw new Error('Cookie na serveru neexistuje, musis se znovu <a href="/login">prihlasit</a>.');
			}
			// check for cookie validity on the server
			let fileStats = FS.statSync(cookieFilePath);
			if ((fileStats.atime.getTime() + c.http.login.validity) - new Date().getTime() < 0) {
				throw new Error('Platnost cookie vyprsela, musis se znovu <a href="/login">prihlasit</a>.');
			}

			// Everything is ok
			let cookieContent = JSON.parse(FS.readFileSync(cookieFilePath).toString());

			// load logged user
			res.locals.user = perms.getUser(cookieContent.email);

			// user is logged but not yet saved in database
			if (!res.locals.user) {
				// logged user is not known, get temporary user object
				res.locals.user = await perms.registerNewUser(cookieContent.email);
			}

			// update cookie expiration on the server
			FS.utimesSync(cookieFilePath, new Date(), new Date());
		} catch (error) {
			// user is not logged, ignore errors and continue as unlogged
			res.clearCookie(c.http.login.name);
			res.locals.user = perms.getNonLoggedUser();
		}
		next();
	});

	/**
	 * API middleware
	 * Load password permissions
	 *
	 * @returns next()
	 */
	webserver.get(endpoint, async function (req, res, next) {
		// Try load and merge perms if user has some passwords
		res.locals.user.clearPasswords();
		try {
			let passwordCookie = req.cookies['pmg-passwords'];
			if (!passwordCookie) {
				throw new Error('No password cookie is available');
			}
			passwordCookie.split(',').forEach(function (password) {
				const passwordObject = perms.getPassword(password);
				if (passwordObject) {
					res.locals.user.addPassword(passwordObject);
				}
			});
		} catch (error) {
			// Do nothing, probably user just dont have cookie
		}
		next();
	});

	/**
	 * API middleware
	 * Validate GET parameter path
	 *
	 * @returns next()
	 */
	webserver.get(endpoint, async function (req, res, next) {
		if (req.query.path) {
			const result = HFS.pathMasterCheck(c.path, req.query.path, res.locals.user.getPermissions(), perms.test);
			Object.assign(res.locals, result);
			if (result.error) {
				// log to debug because anyone can generate invalid paths
				// Error handling must be done on APIs endpoints because everyone returning different format of data (JSON, image stream, video stream, audio stream...)
				// if res.locals.path exists, everything is ok
				LOG.debug('(Web) Requested invalid path "' + req.query.path + '", error: ' + result.error + '.', {console: true});
			}
		}
		next();
	});

	/**
	 * Load and initialize all *.js files from folder named like this file (without extension)
	 */
	const path = PATH.join(__dirname, baseEndpoint);
	let endpoints = [];
	FS.readdirSync(path).forEach(function (file) {
		if (file.match(/^[a-z\-]+\.js$/)) {
			const endpoint = PATH.posix.join(baseEndpoint, PATH.basename(file, '.js'));
			endpoints.push(endpoint);
			require(pathCustom.join(path, file))(webserver, endpoint);
		}
	});
	LOG.info('(Webserver) Loaded ' + endpoints.length + ' "' + baseEndpoint + '" dynamic endpoints: ' + endpoints.join(', '));
};
