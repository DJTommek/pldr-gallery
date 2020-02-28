require(BASE_DIR_GET('/public/js/functions.js'));
const c = require(BASE_DIR_GET('/libs/config.js'));
const LOG = require(BASE_DIR_GET('/libs/log.js'));

const FS = require('fs');
const PATH = require('path');
const HFS = require(BASE_DIR_GET('/libs/helperFileSystem.js'));
const pathCustom = require(BASE_DIR_GET('/libs/path.js'));
const perms = require(BASE_DIR_GET('/libs/permissions.js'));

module.exports = function (webserver, baseEndpoint) {

	/**
	 * Main API middleware:
	 * - validate login cookie (if user logged)
	 * - load (default) user and password permissions
	 *
	 * @returns next()
	 */
	webserver.get(baseEndpoint + '/[a-z]+', function (req, res, next) {
		// Load default user permissions
		let userPerms = perms.getUser('x');
		// Try load perms for logged user
		try {
			let token = req.cookies[c.http.login.name];

			// cookie dont exists or is invalid
			if (!token || !token.match("^[a-f0-9]{40}$")) {
				throw new Error('Musis se <a href="/login">prihlasit</a>.');
			}
			let cookieFilePath = c.http.login.tokensPath + token + '.txt';
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

			res.locals.user = cookieContent.email;
			// load logged user permissions and merge with default user permissions
			userPerms = perms.getUser(cookieContent.email).concat(userPerms);

			// update cookie expiration on the server
			FS.utimesSync(cookieFilePath, new Date(), new Date());
		} catch (error) {
			res.clearCookie(c.http.login.name);
		}

		// Try load and merge perms if user has some passwords
		try {
			let passwordCookie = req.cookies['pmg-passwords'];
			if (!passwordCookie) {
				throw new Error('No password cookie is available');
			}
			passwordCookie.split(',').forEach(function (pass) {
				userPerms = perms.getPass(pass).concat(userPerms);
			});
		} catch (error) {
			// Do nothing, probably user just dont have cookie
		}

		// If user has master permission to root, remove all other permissions
		if (userPerms.indexOf('/') >= 0) {
			userPerms = ['/'];
		}
		res.locals.userPerms = userPerms;

		LOG.info('(Web) Api access ' + req.path + ', user "' + (res.locals.user || 'x') + '"');

		const result = HFS.pathMasterCheck(c.path, req.query.path, res.locals.userPerms, perms.test);
		Object.assign(res.locals, result);
		if (result.error) {
			// log to debug because anyone can generate invalid paths
			// Error handling must be done on APIs endpoints because everyone returning different format of data (JSON, image stream, video stream, audio stream...)
			// if res.locals.path exists, everything is ok
			LOG.debug('(Web) Requested invalid path "' + req.query.path + '", error: ' + result.error + '.', {console: true});
		}

		res.setTimeout(c.http.timeout, function () {
			LOG.error('(Web) Connection timeout for ' + req.path);
			res.result.setError('<b>Nastala chyba</b>, zpracování požadavku trvalo serveru příliš dlouho.<br>Zkus to za chvíli znovu případně kontaktuj admina.').end(408);
		});

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
