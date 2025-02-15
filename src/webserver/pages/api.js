require(BASE_DIR_GET('/src/webserver/private/js/functions.js'));
const c = require(BASE_DIR_GET('/src/libs/config.js'));
const LOG = require(BASE_DIR_GET('/src/libs/log.js'));

const FS = require('fs');
const PATH = require('path');
const HFS = require(BASE_DIR_GET('/src/libs/helperFileSystem.js'));
const pathCustom = require(BASE_DIR_GET('/src/libs/path.js'));
const perms = require(BASE_DIR_GET('/src/libs/permissions.js'));
const structureRepository = require(BASE_DIR_GET('/src/libs/repository/structure.js'));
const PathEncoder = require('../private/js/class/PathEncoder.js');

module.exports = function (webserver, baseEndpoint) {

	const endpoint = baseEndpoint + '/[a-z-]+';

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
	 * API middleware handling requested path.
	 *
	 * Validate GET parameter path. If it is provided, then it must be valid, file or directory must exists and user
	 * must have permission (either go thru to deeper directory or file or full access). If you want to check if full
	 * access is available, use `res.locals.user.testPathPermission(folderItem.path, true)`.
	 *
	 * If path is valid, fills some `res.locals.*` values and continue with request processing. Never use
	 * `req.query.path` directly.
	 * If path is not valid, ends request with 4xx.
	 */
	webserver.get(endpoint, async function (req, res, next) {
		/** @deprecated use `res.locals.pathAbsolute` instead */
		res.locals.fullPathFolder = null;
		/** @deprecated use `res.locals.pathAbsolute` instead */
		res.locals.fullPathFile = null;
		/** @deprecated use `res.locals.pathItem.path` instead */
		res.locals.path = null;
		/** @deprecated use `res.locals.pathItem` instead */
		res.locals.pathItemSimple = null;
		/** @deprecated use `res.locals.pathItem` instead */
		res.locals.getPathItemDb = async function () {
			return null;
		};

		/** @type {string|null} Decoded requested path without validation. */
		res.locals.queryPath = null;
		/** @type {FileItem|FolderItem|null} Path item, that is valid and requested user has permission. */
		res.locals.pathItem = null;
		/** @type {string|null} Absolute path to the path item, that is valid and requested user has permission. */
		res.locals.pathAbsolute = null;

		if (typeof req.query.path === 'string') {
			try {
				let path;
				try {
					path = PathEncoder.decode(req.query.path);
				} catch (error) {
					return res.result.setError('Path has invalid format.').end(400);
				}
				res.locals.queryPath = path;

				const pathItem = await structureRepository.getByPath(path);
				if (pathItem === null) {
					return res.result.setError('Path does not exists or you are missing permissions.').end(403);
				}

				if (res.locals.user.testPathPermission(pathItem.path) === false) {
					return res.result.setError('Path does not exists or you are missing permissions.').end(403);
				}

				res.locals.pathItem = pathItem;
				res.locals.pathAbsolute = pathCustom.relativeToAbsolute(pathItem.path, c.path);

				if (pathItem.isFolder) {
					res.locals.fullPathFolder = res.locals.pathAbsolute; // Backward compatibility
				}
				if (pathItem.isFile) {
					res.locals.fullPathFile = res.locals.pathAbsolute; // Backward compatibility
				}
				if (pathItem) {
					res.locals.path = pathItem.path; // Backward compatibility
				}
				res.locals.pathItemSimple = pathItem; // Backward compatibility
				res.locals.getPathItemDb = async function () {
					return pathItem;
				}
			} catch (error) {
				LOG.error('(Web) Error validating query path: "' + error.message + '"');
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
