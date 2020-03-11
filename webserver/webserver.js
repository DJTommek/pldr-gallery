require(BASE_DIR_GET('/private/js/functions.js'));
const c = require(BASE_DIR_GET('/libs/config.js'));
const LOG = require(BASE_DIR_GET('/libs/log.js'));

const FS = require("fs");
const pathCustom = require(BASE_DIR_GET('/libs/path.js'));
const PATH = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const terser = require('terser');

const http = require('http');
const https = require('https');
const express = require('express');
const lessMiddleware = require('less-middleware');
const compression = require('compression');
const webserver = express();
webserver.use(bodyParser.json()); // support json encoded bodies
webserver.use(bodyParser.urlencoded({extended: true})); // support encoded bodies
webserver.use(cookieParser()); // support cookies
webserver.use(lessMiddleware(c.less.sourcePath, c.less.options));
webserver.use(express.static(c.http.publicPath));
webserver.use(compression());

/**
 * Middleware for all requests
 *
 * @return next()
 */
webserver.all('*', function (req, res, next) {
	// Log request
	let weblog = '';
	weblog += '[' + req.ip + ']';
	weblog += '[' + req.method + ',' + req.protocol + ']';
	weblog += '[' + req.path + ']';
	weblog += '[GET:' + JSON.stringify(req.query) + ']';
	weblog += '[POST:' + JSON.stringify(req.body) + ']';
	LOG.webserver(weblog);

	// define quick JSON response object
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
			this.duration = this.getDuration(true);
			if (httpResponseCode) {
				res.status(httpResponseCode);
			}
			res.end(this.toString());
		}
	};
	return next();
});

/**
 * Public repository should handle loading root folder by loading index.html so this route should not be never matched.
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
	LOG.error('(Webserver) Index file is missing, check log if file was generated and was created in "public/index.html"');
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
	https.createServer({
		key: FS.readFileSync(c.http.ssl.keyPath),
		cert: FS.readFileSync(c.http.ssl.certPath),
	}, webserver).listen(c.http.ssl.port, function () {
		LOG.info('(Webserver) Secured HTTPS server listening on port :' + c.http.ssl.port + '.');
	});
	// Start HTTP server to redirect all traffic to HTTPS
	http.createServer(function (req, res) {
		// if is used default port, dont add it at the end. URL starting with https is enough for browsers
		const newPort = (c.http.ssl.port === 443) ? '' : ':' + c.http.ssl.port;
		res.writeHead(301, {'Location': 'https://' + req.headers['host'].replace(new RegExp(':' + c.http.port + '$'), '') + newPort + req.url});
		res.end();
	}).listen(c.http.port, function () {
		LOG.info('(Webserver) Non-secured HTTP server listening on port :' + c.http.port + ' but all traffic will be automatically redirected to https.');
	});
} else {
	LOG.info('(Webserver) SSL is disabled, starting only HTTP server...');

	http.createServer(webserver).listen(c.http.port, function () {
		LOG.info('(Webserver) Non-secured HTTP server listening on port :' + c.http.port + '.');
	});
}

/**
 * Generate public/index.html
 *
 * - inject Google maps API key from config
 * - run cachebuster by replacing every variable {{CACHEBUSTER_<FILE_PATH>}} with modified time in miliseconds
 * 	 For example, if "public/main.css" was lastly modified at 2020-01-01 00:00:00, string {{CACHEBUSTER_PUBLIC_MAIN.CSS}} will be replaced with 1577833200000
 *   In your code:
 *   <link rel="stylesheet" href="main.css?{{CACHEBUSTER_PUBLIC_MAIN.CSS}}">
 *   Will be replaced with:
 *   <link rel="stylesheet" href="main.css?1577833200000">
 */
FS.readFile(BASE_DIR_GET('/private/index.html'), function (error, data) {
	if (error) {
		LOG.fatal('Cannot load private index file for generating public index.html, error: ' + error.message);
	}
	let promises = [];
	let fileContent = data.toString();
	[
		'private/less/main.less',
		'public/js/main.js',
	].forEach(function (file) {
		const htmlVariable = '{{CACHEBUSTER_' + file.replaceAll('/', '_').toUpperCase() + '}}';
		promises.push(new Promise(function (resolve) {
			FS.stat(BASE_DIR_GET(file), function (error, data) {
				if (error) {
					LOG.error('Error while creating cachebuster variable for "' + file + '": ' + error.message);
					resolve();
					return;
				}
				resolve({name: htmlVariable, value: Math.floor(data.mtimeMs)});
			});
		}));
	});

	Promise.all(promises).then(function (data) {
		data.forEach(function (replacePair) {
			if (replacePair) {
				fileContent = fileContent.replace(replacePair.name, replacePair.value);
			}
		});
		fileContent = fileContent.replace('{{GOOGLE_MAPS_API_KEY}}', c.google.mapApiKey);
		fileContent = fileContent.replace('{{CACHEBUSTER_PUBLIC_JS_MODULES_MIN.JS}}', getNewestFileUpdateTime(c.terser.filesToCompile).toString());
		// share some of server-side variables to FE
		fileContent = fileContent.replace('{{SERVER_CONFIG}}', JSON.stringify({
			thumbnails: {
				width: c.thumbnails.width,
				height: c.thumbnails.height,
				image: {
					enabled: c.thumbnails.image.enabled,
				},
				folder: {
					enabled: c.thumbnails.folder.enabled,
				},
			},
			archive: {
				enabled: c.archive.enabled,
			},
		}));
		// build final index file
		FS.writeFile(BASE_DIR_GET('/public/index.html'), fileContent, function (error) {
			if (error) {
				LOG.fatal('(Webserver) Fatal error while saving generated public/index.html file: ' + error.message);
			} else {
				LOG.info('(Webserver) Main public/index.html was successfully generated.');
			}
		});
	});
});

/**
 * Generate one javascript file with all necessary javascript classes
 */
let finalContent = '';
c.terser.filesToCompile.forEach(function (file) {
	finalContent += FS.readFileSync(file);
});
const finalContentUgly = terser.minify(finalContent, c.terser.options);
FS.writeFile(c.terser.destinationPath, finalContentUgly.code, function (error) {
	if (error) {
		LOG.fatal('(Webserver) Fatal error while saving generated public/js/modules.min.js file: ' + error.message);
	} else {
		LOG.info('(Webserver) Main public/js/modules.min.js file was successfully generated.');
	}
});

/**
 * Create cache folders if caching is enabled
 */
if (c.thumbnails.image.enabled === true && c.thumbnails.image.cache === true) {
	const path = pathCustom.join(c.cache.path, '/thumbnails/image/');
	FS.mkdir(path, {recursive: true}, function(error) {
		if (error) {
			LOG.error('(Cache) Error while creating folder for image-thumbnails: ' + error.message);
		}
	});
}
if (c.thumbnails.folder.enabled === true && c.thumbnails.folder.cache === true) {
	const path = pathCustom.join(c.cache.path, '/thumbnails/folder/');
	FS.mkdir(path, {recursive: true}, function(error) {
		if (error) {
			LOG.error('(Cache) Error while creating folder for folder-thumbnails: ' + error.message);
		}
	});
}

/**
 * Check all files for last update time and return the newest time
 *
 * @param {[string]} files which should be checked
 * @returns {number} UNIX time in milliseconds
 */
function getNewestFileUpdateTime(files) {
	let lastUpdateTime = 0;
	files.forEach(function(file) {
		const fileStats = FS.statSync(BASE_DIR_GET(file));
		lastUpdateTime = (fileStats.mtimeMs > lastUpdateTime) ? fileStats.mtimeMs : lastUpdateTime;
	});
	return Math.floor(lastUpdateTime);
}

module.exports = webserver;