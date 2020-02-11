require(process.cwd() + '/public/js/functions.js');
const c = require(process.cwd() + '/libs/config.js');
const LOG = require(process.cwd() + '/libs/log.js');

const FS = require("fs");
const HFS = require(process.cwd() + '/libs/helperFileSystem.js');
const PATH = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

const http = require('http');
const https = require('https');
const express = require('express');
const compression = require('compression');
const webserver = express();
webserver.use(bodyParser.json()); // support json encoded bodies
webserver.use(bodyParser.urlencoded({extended: true})); // support encoded bodies
webserver.use(cookieParser()); // support cookies
webserver.use(express.static('public'));
webserver.use(compression());

/**
 * Middleware for all requests
 * - logging GET and POST
 * - define quick JSON response object
 *
 * @return next()
 */
webserver.all('*', function (req, res, next) {
	let weblog = '';
	weblog += '[' + req.ip + ']';
	weblog += '[' + req.method + ',' + req.protocol + ']';
	weblog += '[' + req.path + ']';
	weblog += '[GET:' + JSON.stringify(req.query) + ']';
	weblog += '[POST:' + JSON.stringify(req.body) + ']';
	LOG.webserver(weblog);

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
		}, end: function (httpResponseCode) {
			this.duration = msToHuman(new Date() - requestStart);
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
webserver.get('/', function (req, res) {
	res.result.setError('Fatal error occured, index file is missing. Contact administrator.').end(500);
	LOG.error('Index file is missing, check log if file was generated and was created in "public/index.html"');
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
		require(HFS.pathJoin(path, file))(webserver, baseEndpoint);
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
FS.readFile('./private/index.html', function (error, data) {
	if (error) {
		LOG.fatal('Cannot load private index file for generating public index.html, error: ' + error.message);
	}
	let promises = [];
	let fileContent = data.toString();
	[
		'public/main.css',
		'public/js/main.js',
		'public/js/functions.js',
		'public/js/cookie.js',
		'public/js/settings.js',
		'public/js/structure.js',
		'public/js/keyboard.js'
	].forEach(function (file) {
		const htmlVariable = '{{CACHEBUSTER_' + file.replaceAll('/', '_').toUpperCase() + '}}';
		promises.push(new Promise(function (resolve) {
			FS.stat(file, function (error, data) {
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
		FS.writeFile('./public/index.html', fileContent, function (error) {
			if (error) {
				LOG.fatal('Fatal error while saving generated public/index.html file: ' + error.message);
			} else {
				LOG.info('Main public/index.html was successfully generated.');
			}
		});
	});
});
