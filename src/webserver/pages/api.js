require(BASE_DIR_GET('/src/webserver/private/js/functions.js'));
const c = require(BASE_DIR_GET('/src/libs/config.js'));
const LOG = require(BASE_DIR_GET('/src/libs/log.js'));

const FS = require('fs');
const PATH = require('path');
const pathCustom = require(BASE_DIR_GET('/src/libs/path.js'));
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
