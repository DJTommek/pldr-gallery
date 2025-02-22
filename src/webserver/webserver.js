require('./private/js/functions.js');
const c = require('../libs/config.js');
const LOG = require('../libs/log.js');

const FS = require("fs");
const pathCustom = require('../libs/path.js');
const PATH = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const http = require('http');
const https = require('https');
const express = require('express');
const lessMiddleware = require('less-middleware');
const compression = require('compression');
const serverTiming = require('server-timing');
const webserver = express();
const fileGenerators = require('./fileGenerators');
const perms = require(BASE_DIR_GET('/src/libs/permissions.js'));

webserver.use(bodyParser.json()); // support json encoded bodies
webserver.use(bodyParser.urlencoded({extended: true})); // support encoded bodies
webserver.use(bodyParser.raw()); // support raw body
webserver.use(cookieParser()); // support cookies
webserver.use(lessMiddleware(c.less.sourcePath, c.less.options));
webserver.use(express.static(c.http.publicPath));
webserver.use(express.static(c.http.publicPathGenerated));
webserver.use(compression());
webserver.use(serverTiming());
webserver.disable('x-powered-by');
webserver.set('trust proxy', c.http.trustProxy);

module.exports.httpServer = null;
module.exports.httpsServer = null;

/**
 * @return next()
 */
webserver.all('*', function (req, res, next) {
	res.locals.hrtimeStart = process.hrtime();
	next();
});

/**
 * Log request to file
 * @return next()
 */
webserver.all('*', function (req, res, next) {
	// Log request
	let weblog = {
		ip: req.ip,
		method: req.method,
		headers: req.headers,
		protocol: req.protocol,
		path: req.path,
		get: req.query,
		post: req.body,
	};
	LOG.webserver(weblog);
	next();
});

/**
 * Define quick JSON response object
 * @return next()
 */
webserver.all('*', function (req, res, next) {
	const requestStart = new Date();
	res.result = {
		datetime: (new Date).human(),
		error: true,
		message: '',
		duration: null,
		result: [],
		setError: function (text) {
			this.error = true;
			this.message = text;
			this.result = [];
			return this;
		}, setResult: function (result, message) {
			this.error = false;
			this.result = result;
			if (message) {
				this.message = message;
			}
			return this;
		}, toString: function () {
			return JSON.stringify(this, null, 4);
		}, getDuration: function (format = false) {
			const duration = new Date() - requestStart;
			if (format === true) {
				return msToHuman(duration);
			}
			return duration;
		}, end: function (httpResponseCode) {
			res.setHeader('Content-Type', 'application/json');
			this.duration = this.getDuration(true);
			if (httpResponseCode) {
				res.status(httpResponseCode);
			}
			res.end(this.toString());
		}
	};
	next();
});

/**
 * Shortcut for /api/password
 */
webserver.get(c.http.apiPasswordShortcut, function (req, res) {
	res.redirect('/api/password?password=' + req.params.password);
});

/**
 * Public repository should handle loading generated modules so this route should not be never matched.
 */
webserver.get('/js/modules.min.js', function (req, res) {
	res.result.setError('Fatal error occured, generated javascript file is missing. Contact administrator.').end(500);
	LOG.error('(Webserver) Generated javascript file is missing, check log if file was generated and was created in "public/js/modules.min.js"');
});

/**
 * Public repository should handle loading javascript asset files index.html so this route should not be never matched.
 */
webserver.get('/', function (req, res) {
	res.result.setError('Fatal error occured, index file is missing. Contact administrator.').end(500);
	LOG.error('(Webserver) Index file is missing, check log if file was generated and was created in "temp/webserver/public/index.html"');
});

/**
 * Load user permissions
 *
 * @returns next()
 */
webserver.all('*', async function (req, res, next) {
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
 * Load password permissions
 *
 * @returns next()
 */
webserver.all('*', async function (req, res, next) {
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
 * Load and initialize all *.js files from /webserver/pages folder
 */
const path = PATH.join(__dirname, 'pages');
let endpoints = [];
FS.readdirSync(path).forEach(function (file) {
	if (file.match(/^[a-z\-]+\.js$/)) {
		const baseEndpoint = PATH.posix.join('/' + PATH.basename(file, '.js'));
		endpoints.push(baseEndpoint);
		require(pathCustom.join(path, file))(webserver, baseEndpoint);
	}
});
LOG.info('(Webserver) Loaded ' + endpoints.length + ' page(s): ' + endpoints.join(', '));

/**
 * 404: Not found handler
 */
webserver.use(function (req, res) {
	res.result.setError('404: Page not found').end(404);
});


/**
 * Start HTTP(S) server(s)
 */
if (c.http.ssl.enable === true) {
	LOG.info('(Webserver) SSL is enabled, starting both HTTP and HTTPS servers...');
	// Start HTTPS server
	module.exports.httpsServer = https.createServer({
		key: FS.readFileSync(c.http.ssl.keyPath),
		cert: FS.readFileSync(c.http.ssl.certPath),
	}, webserver).listen(c.http.ssl.port, function () {
		LOG.info('(Webserver) Secured HTTPS server listening on port :' + c.http.ssl.port + '.');
	});
	// Start HTTP server to redirect all traffic to HTTPS
	module.exports.httpServer = http.createServer(function (req, res) {
		// if is used default port, dont add it at the end. URL starting with https is enough for browsers
		const newPort = (c.http.ssl.port === 443) ? '' : ':' + c.http.ssl.port;
		res.writeHead(301, {'Location': 'https://' + req.headers['host'].replace(new RegExp(':' + c.http.port + '$'), '') + newPort + req.url});
		res.end();
	}).listen(c.http.port, function () {
		LOG.info('(Webserver) Non-secured HTTP server listening on port :' + c.http.port + ' but all traffic will be automatically redirected to https.');
	});
} else {
	LOG.info('(Webserver) SSL is disabled, starting only HTTP server...');

	module.exports.httpServer = http.createServer(webserver).listen(c.http.port, function () {
		LOG.info('(Webserver) Non-secured HTTP server listening on port :' + c.http.port + '.');
	});
}

(async function () {
	await fileGenerators.generateIndexHtml();
	await fileGenerators.generateModulesJs();
})();

/**
 * Create cache folders if caching is enabled
 */
if (c.thumbnails.image.enabled === true) {
	const path = pathCustom.join(c.cache.path, '/thumbnails/image/');
	FS.mkdir(path, {recursive: true}, function (error) {
		if (error) {
			LOG.error('(Cache) Error while creating folder for image-thumbnails: ' + error.message);
		}
	});
}
if (c.thumbnails.folder.enabled === true) {
	const path = pathCustom.join(c.cache.path, '/thumbnails/folder/');
	FS.mkdir(path, {recursive: true}, function (error) {
		if (error) {
			LOG.error('(Cache) Error while creating folder for folder-thumbnails: ' + error.message);
		}
	});
}

if (c.thumbnails.video.enabled === true) {
	const path = pathCustom.join(c.cache.path, '/thumbnails/video/');
	FS.mkdir(path, {recursive: true}, function (error) {
		if (error) {
			LOG.error('(Cache) Error while creating folder for video-thumbnails: ' + error.message);
		}
	});
}

/**
 * Create folder for generated less files
 */
FS.mkdir(PATH.dirname(c.less.options.dest), {recursive: true}, function (error) {
	if (error) {
		LOG.error('(Less) Error while creating folder for less files: ' + error.message);
	}
});

/**
 * Create folder for saving login tokens
 */
FS.access(c.http.login.tokensPath, (err) => {
	if (err) { // folder doesn't exists
		FS.mkdir(c.http.login.tokensPath, {recursive: true}, function (error) {
			if (error) {
				LOG.error('(Login) Error while creating folder for login tokens: ' + error.message);
			} else {
				LOG.info("(Login) Created folder for saving login tokens.");
			}
		});
	}
});
