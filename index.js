require('./public/js/functions.js');
const c = require('./libs/config.js');
const LOG = require('./libs/log.js');
require('./public/js/structure.js');
const sha1 = require('sha1');

const globby = require('globby');
const FS = require("fs");
const HFS = require('./libs/helperFileSystem');
const readdirp = require('readdirp');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const perms = require('./libs/permissions.js');
perms.load();

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

const exifParser = require('exif-parser');

const googleAuthLibrary = require('google-auth-library');
const oauth2Client = new googleAuthLibrary.OAuth2Client(c.google.clientId, c.google.secret, c.google.redirectUrl);

const sharp = require('sharp');

const start = new Date();
LOG.info('***STARTING***');

// Check if config.path is set correctly
try {
	let folderStats = FS.statSync(c.path);
	if (folderStats.isDirectory() === false) {
		throw new Error('it is not directory');
	}
	let items = FS.readdirSync(c.path);
	if (items.length === 0) {
		throw new Error('no items in base folder');
	}
	LOG.info('(Start) Defined base path "' + c.path + '" is valid with ' + items.length + ' items.');
} catch (error) {
	LOG.fatal('(Start) Defined base path "' + c.path + '" is invalid. Error: ' + error.message);
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
FS.readFile('./private/index.html', function(error, data) {
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
	].forEach(function(file) {
		const htmlVariable = '{{CACHEBUSTER_' + file.replaceAll('/', '_').toUpperCase() + '}}';
		promises.push(new Promise(function (resolve) {
			FS.stat(file, function(error, data) {
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
		data.forEach(function(replacePair) {
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

function getUptime() {
	const diff = (new Date() - start);
	return {
		start: start.human(),
		uptime: {
			milliseconds: diff,
			human: msToHuman(diff)
		}
	};
}

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
		}, end: function(httpResponseCode) {
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
 * Google logout - just redirect, more info in "/api/logout"
 */
webserver.get('/logout', function (req, res) {
	res.redirect('/api/logout');
});

/**
 * Google login:
 * - redirect to the google login page (if no req.query.code is available)
 * - handling redirect back from Google page (req.query.code is available)
 *
 * @return HTML text if error
 * @return redirect if ok
 */
webserver.get('/login', function (req, res) {
	res.clearCookie(c.http.login.name);
	let code = req.query.code;
	// Non-logged user (dont have cookie) wants to login. Generate Google login URL and redirect to it.
	// If is login successfull, user will be redirected back with req.code filled
	if (code === undefined) {
		res.redirect(oauth2Client.generateAuthUrl({
			scope: 'email'
		}));
		return;
	}
	code = code.replace('\\', '/'); // Probably bug, backslash has to be escaped
	// User was redirected after success login. Check this code with Google and if is ok, save info about user in
	// file name generated by hash of code
	oauth2Client.getToken(code, function (errGetToken, tokens, response) {
		if (errGetToken) {
			LOG.error('(Login) Error while loading Google token: ' + errGetToken + '. More info in debug.');
			try {
				LOG.debug('(Login) ' + JSON.stringify(response));
			} catch (error) {
				LOG.debug('(Login) Error while parsing response while loading Google token.');
			}
			res.status(500).send('Chyba behem ziskavani google tokenu. Zkus to <a href="/login">znovu</a> nebo kontaktuj admina.<br><a href="/logout">Odhlasit</a>');
			return;
		}
		// Check token and get user email
		oauth2Client.verifyIdToken({idToken: tokens.id_token}, function (errVerifyToken, login) {
			if (errVerifyToken) {
				LOG.error('(Login) Error while verifying Google token: ' + errVerifyToken);
				res.status(500).send('Chyba behem ziskavani google tokenu. Zkus to <a href="/login">znovu</a> nebo kontaktuj admina.<br><a href="/logout">Odhlasit</a>');
				return;
			}
			// Load info about user from Google
			let payload = login.getPayload();
			LOG.info('(Login) Logged user "' + payload.email + '".');
			let tokenHash = sha1(tokens.id_token);

			FS.writeFileSync(c.http.login.tokensPath + tokenHash + '.txt', JSON.stringify({
				logged_time: new Date().getTime(),
				token_id: tokens.id_token,
				token_hash: tokenHash,
				ip: req.ip,
				email: payload.email
			}), 'utf8');
			res.cookie(c.http.login.name, tokenHash, {expires: new Date(253402300000000)});
			res.redirect('/');
		});
	});
});

/**
 * Main API middleware:
 * - validate login cookie (if user logged)
 * - load (default) user and password permissions
 *
 * @returns next()
 */
webserver.get('/api/[a-z]+', function (req, res, next) {
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

    res.setTimeout(c.http.timeout, function() {
    	LOG.error('(Web) Connection timeout for ' + req.path);
		res.result.setError('<b>Nastala chyba</b>, zpracování požadavku trvalo serveru příliš dlouho.<br>Zkus to za chvíli znovu případně kontaktuj admina.').end(408);
	});

	next();
});

/**
 * Set media type for specific api endpoints
 *
 * @return next()
 */
webserver.get(['/api/image', '/api/video', '/api/audio'], function (req, res, next) {
	if (res.locals.fullPathFile) {
		const ext = HFS.extname(res.locals.fullPathFile);
		const extData = (new FileExtensionMapper).get(ext);
		if (extData && extData.mediaType) {
			res.locals.mediaType = extData.mediaType;
		} else {
			const error = 'File extension "' + ext + '" has no defined media type.';
			LOG.error(error);
			res.result.setError(error).end(500);
		}
	}
	next();
});


/**
 * Run user search in all files and folders
 * - case insensitive
 * - search is performed in folder, what user has loaded (param path)
 *
 * @param query - searching string
 * @param path - where to search
 */
webserver.get('/api/search', function (req, res) {
	res.statusCode = 200;
	res.setHeader("Content-Type", "application/json");
	let finds = {
		folders: [{ // always show "close searching" button
			path: res.locals.path,
			noFilter: true,
			text: 'Zavřít vyhledávání "' + req.query.query + '"',
			icon: (new Icons).CLOSE_SEARCHING,
		}],
		files: []
	};
	try {
		if (!req.query.query) {
			throw new Error('no search query');
		}
		if (!res.locals.fullPathFolder) {
			throw new Error('no path');
		}
	} catch (error) {
		res.result.setError('Error while searching: ' + error.message).end();
		return;
	}

	let logPrefix = '(Web) Searching "' + req.query.query + '" in path "' + res.locals.path + '"';
	let readDirStart = new Date();

	// Do not use readdirp.fileFilter option because is case sensitive.
	// Instead create custom file extensions regex with case-insensitive parameter
	// Closed github request, Option for case-insensitive filter: https://github.com/paulmillr/readdirp/issues/47
	readdirp(res.locals.fullPathFolder, {type: 'files_directories', depth: 10, alwaysStat: false}).on('data', function (entry) {
		try {
			// fallback to stats because dirent is not supported (probably node.js version is older than 10.10.0)
			// https://github.com/paulmillr/readdirp/issues/95
			// https://nodejs.org/api/fs.html#fs_class_fs_dirent
			const item = entry.dirent || entry.stats;

			if (item.isFile() && entry.basename.match((new FileExtensionMapper).regexAll) === null) {
				return; // file has invalid extension
			}

			let entryPath = HFS.pathNormalize(entry.fullPath, HFS.pathJoin(__dirname, c.path));
			if (entry.basename.toLowerCase().indexOf(req.query.query.toLowerCase()) === -1) {
				return; // not match with searched query
			}

			if (perms.test(res.locals.userPerms, entryPath) === false) {
				return; // user dont have permission to this item
			}

			let pathData = {
				path: entryPath,
				text: entryPath
			};
			if (item.isDirectory()) {
				pathData.path += '/';
				finds.folders.push(pathData);
			} else { // is file, load detailed info
				let pathStats = FS.lstatSync(entry.fullPath);
				pathData.size = pathStats.size;
				pathData.created = pathStats.ctime;
				finds.files.push(pathData);
			}
		} catch (error) {
			LOG.error(logPrefix + ' throwed error while processing readdirp results: ' + error);
		}
	}).on('warn', function (warning) {
		LOG.warning(logPrefix + ' throwed warning: ' + warning);
	}).on('error', function (error) {
		LOG.error(logPrefix + ' throwed error: ' + error);
	}).on('end', function () {
		let humanTime = msToHuman(new Date() - readDirStart);
		LOG.info(logPrefix + ' is done in ' + humanTime + ', founded ' + finds.folders.length + ' folders and ' + finds.files.length + ' files.');
		res.result.setResult(finds, 'Done in ' + humanTime).end();
	});
});

/**
 * Force download file instead custom headers for image, video etc.
 *
 * @returns streamed file if ok
 * @returns JSON if error
 */
webserver.get('/api/download', function (req, res) {
	res.statusCode = 200;
	try {
		if (!res.locals.fullPathFile) {
			throw new Error('invalid or missing path');
		}

		res.setHeader('Content-Disposition', 'inline; filename="' + encodeURI(res.locals.fullPathFile.split('/').pop()) + '"');
		LOG.info('(Web) Streaming file to download: ' + res.locals.fullPathFile);
		return FS.createReadStream(res.locals.fullPathFile).pipe(res);
	} catch (error) {
		res.statusCode = 404;
		res.result.setError('Error while loading file: ' + error.message).end();
	}
});

/**
 * Check and/or update passwords
 * If no parameter is set, list of passwords and permissions to these passwords is returned
 * If parameter "password" is set and valid, save it to the cookie and returns permissions to this passwords
 *
 * @requires password (optional)
 * @returns JSON list of permissions
 */
webserver.get('/api/password', function (req, res) {
	res.setHeader("Content-Type", "application/json");
	res.statusCode = 200;
	let cookiePasswords = req.cookies['pmg-passwords'];
	try {
		// If no password parameter is set, return list of all passwords
		if (!req.query.password) {
			let passwordPerms = [];
			if (cookiePasswords) {
				cookiePasswords.split(',').forEach(function (password) {
					passwordPerms.push({
						password: password,
						permissions: perms.getPass(password)
					});
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
		let passwordPerms = perms.getPass(req.query.password);
		if (passwordPerms.length === 0) {
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
		// return list of permissions to this password
		res.result.setResult({
			password: req.query.password,
			permissions: passwordPerms
		}, 'Password "' + req.query.password + '" is valid.');
		if (req.xhr) {
			// no redirect if ajax request
		} else if (req.query.redirect && req.query.redirect === 'false') {
			// no redirect if param redirect=false
		} else {
			// automatic redirect to the folder
			let redirectFolder = passwordPerms[0];
			if (redirectFolder.slice(-1) !== '/') {
				// this is not folder, redirect to dirname of this path
				redirectFolder = HFS.pathDirname(redirectFolder);
			}
			res.cookie('pmg-redirect', redirectFolder, {expires: new Date(253402300000000)});
			res.redirect('/');
		}
	} catch (error) {
		res.result.setError('Error while checking password: ' + error.message).end();
	}
	res.result.end();
});

/**
 * Stream image.
 * Image can be compressed via cookie. This can be overriden via GET compress=true or false
 *
 * @returns image stream (in case of error, streamed image with error text)
 */
webserver.get('/api/image', function (req, res) {
	res.statusCode = 200;
	try {
		if (!res.locals.fullPathFile) {
			throw new Error('Neplatná cesta nebo nemáš právo');
		}
		const extensionData = (new FileExtensionMapper).getImage(HFS.extname(res.locals.fullPathFile));
		if (!extensionData) {
			throw new Error('Soubor nemá příponu obrázku.');
		}
		let imageStream = FS.createReadStream(res.locals.fullPathFile);
		if ((req.cookies['pmg-compress'] === 'true' && req.query.compress !== 'false') || req.query.compress === 'true') {
			imageStream = imageStream.pipe(sharp().resize(c.compress));
		}

		res.setHeader("Content-Type", res.locals.mediaType);

		return imageStream.pipe(res);
	} catch (error) {
		res.statusCode = 404;
		let fontSize = 40;
		let textBuffer = new Buffer.from(
			'<svg height="' + (fontSize) + '" width="700">' +
			'  <text x="50%" y="30" dominant-baseline="hanging" text-anchor="middle" font-size="' + fontSize + '" fill="#fff">Chyba: ' + error.message + '</text>' +
			'</svg>'
		);

		sharp({
			create: {
				width: 700,
				height: 100,
				channels: 4,
				background: { r: 220, g: 53, b: 69, }
			}
		}).composite([{ input: textBuffer}]).png().pipe(res);
	}
});

/**
 * Stream video or audio into browser
 *
 * @author https://medium.com/better-programming/video-stream-with-node-js-and-html5-320b3191a6b6
 * @returns video/audio stream
 */
webserver.get(['/api/video', '/api/audio'], function (req, res) {
	res.statusCode = 200;
	try {
		if (!res.locals.fullPathFile) {
			throw new Error('Invalid path for streaming file');
		}
		if (!res.locals.mediaType) {
			throw new Error('File cannot be streamed because of missing media type.');
		}
		const ext = HFS.extname(res.locals.fullPathFile);
		if (req.path === '/api/video' && !(new FileExtensionMapper).getVideo(ext)) {
			throw new Error('File do not have file extension of video');
		} else if (req.path === '/api/audio' && !(new FileExtensionMapper).getAudio(ext)) {
			throw new Error('File do not have file extension of audio');
		}
		const fileSize = FS.statSync(res.locals.fullPathFile).size;
		const range = req.headers.range;
		if (range) {
			const parts = range.replace(/bytes=/, "").split("-");
			const start = parseInt(parts[0], 10);
			const end = (parts[1] ? parseInt(parts[1], 10) : fileSize - 1);
			const file = FS.createReadStream(res.locals.fullPathFile, {start, end});
			res.writeHead(206, {
				'Content-Range': `bytes ${start}-${end}/${fileSize}`,
				'Accept-Ranges': 'bytes',
				'Content-Length': (end - start) + 1, // chunk size
				'Content-Type': res.locals.mediaType
			});
			file.pipe(res);
		} else {
			res.writeHead(200, {
				'Content-Length': fileSize,
				'Content-Type': res.locals.mediaType
			});
			FS.createReadStream(res.locals.fullPathFile).pipe(res);
		}
	} catch (error) {
		res.statusCode = 404;
		res.result.setError('Error while loading file to stream: ' + error.message).end();
	}
});

/**
 * Google logout
 * - remove cookie from the server (cant be used anymore)
 * - request browser to remove it from browser
 *
 * @returns JSON if ajax
 * @returns redirect otherwise
 */
webserver.get('/api/logout', function (req, res) {
	res.setHeader("Content-Type", "application/json");
	res.statusCode = 200;
	try {
		if (!res.locals.user) { // is logged (it means cookie is valid)
			throw new Error('Not logged in.');
		}
		let token = req.cookies[c.http.login.name];
		try {
			// remove cookie from server file
			FS.unlinkSync(c.http.login.tokensPath + token + '.txt');
		} catch (error) {
			LOG.error('Cant delete token "' + token + '", error: ' + error);
			throw new Error('Cant delete token. More info in log.');
		}
		res.result.setResult('Cookie was deleted');
	} catch (error) {
		res.result.setError(error.message || error);
	}
	res.clearCookie(c.http.login.name); // send request to browser to remove cookie
	res.result.end();
});

/**
 * Show uptime data
 *
 * @returns JSON
 */
webserver.get('/api/ping', function (req, res) {
	res.setHeader("Content-Type", "application/json");
	res.statusCode = 200;
	res.result.setResult(getUptime()).end();
});

/**
 * Save reports (errors, feedback, etc)
 *
 * @returns JSON
 */
webserver.post('/api/report', function (req, res) {
	res.setHeader("Content-Type", "application/json");
	res.statusCode = 200;
	let msg = '(Report) User "' + (res.locals.user ? res.locals.user : 'x') + '" is reporting ';
	if (req.body.type && req.body.type.match(/^[a-zA-Z0-9_\-.]{1,20}$/) && req.body.raw) {
		switch (req.body.type) {
			case 'javascript':
				LOG.error(msg += 'javascript error:\n' + req.body.raw);
				break;
			default:
				LOG.debug(msg += 'type="' + req.body.type + '":\n"' + req.body.raw + '".');
				break;
		}
		res.result.setResult(null, 'Report saved').end();
	} else {
		res.result.setError('Invalid "type" or "raw" POST data').end();
	}
});

/**
 * Kill server
 *
 * @returns JSON
 */
webserver.get('/api/kill', function (req, res) {
	res.setHeader("Content-Type", "application/json");

	if (req.query.password !== c.security.killPassword) {
		res.result.setError('Wrong password').end();
		return;
	}
	res.result.setResult(null, 'pldrGallery is going to kill in 2 seconds.').end();
	LOG.head('(Web) Server is going to kill');
	setTimeout(function () {
		process.exit();
	}, 2000);
});

/**
 * Load list items (of files and folders) from given path
 *
 * @returns JSON
 */
webserver.get('/api/structure', function (req, res) {
	res.statusCode = 200;
	res.setHeader("Content-Type", "application/json");
	if (!res.locals.fullPathFolder) {
		res.result.setError('Zadaná cesta "<b>' + res.locals.queryPath + '</b>" není platná nebo na ni nemáš právo.').end();
		return;
	}

	function sortItemsByPath(a, b) {
		return a.path.toLowerCase().localeCompare(b.path.toLowerCase());
	}

	const loadFoldersPromise = new Promise(function (resolve) {
		let folders = [];
		// if requested folder is not root, add one FolderItem to go back
		if (res.locals.path !== '/') {
			folders.push(new FolderItem(null, {
				path: generateGoBackPath(res.locals.path),
				text: '..',
				noFilter: true,
				icon: (new Icons).FOLDER_GO_BACK,
			}).serialize());
		}
		globby(res.locals.fullPathFolder + '*', {markDirectories: true, onlyDirectories: true}).then(function (rawPathsFolders) {
			rawPathsFolders.forEach(function (fullPath) {
				const dynamicPath = HFS.pathMakeDynamic(c.path, fullPath);
				if (perms.test(res.locals.userPerms, dynamicPath) === false) {
					return;
				}
				folders.push(new FolderItem(null, {
					path: dynamicPath
				}).serialize());
			});
			folders.sort(sortItemsByPath);
			resolve(folders);
		}).catch(function (error) {
			LOG.error('[Globby] Error while processing folders in "' + res.locals.fullPathFolder + '": ' + error.message);
			resolve([]);
		});
	});

	const loadFilesPromise = new Promise(function (resolve) {

		function getCoordsFromExifFromFile(fullPath) {
			if (fullPath.match((new FileExtensionMapper).regexExif) === null)  {
				return {};
			}
			const extData = (new FileExtensionMapper).get(HFS.extname(fullPath));
			if (extData === undefined || typeof extData.exifBuffer !== 'number') {
				return {};
			}

			// how big in bytes should be buffer for loading EXIF from file (depends on specification)
			// https://ftp-osl.osuosl.org/pub/libpng/documents/pngext-1.5.0.html#C.eXIf
			// jpeg: 2^16-9 (65 527) bytes = 65.53 KB
			// png: 2^31-1 (2 147 483 647) bytes  = 2.15 GB

			// create small buffer, fill it with first x bytes from image and parse
			let exifBuffer = new Buffer.alloc(extData.exifBuffer);
			try {
				FS.readSync(FS.openSync(fullPath, 'r'), exifBuffer, 0, extData.exifBuffer, 0);
				let parsed = exifParser.create(exifBuffer).parse();
				if (parsed.tags.GPSLatitude && parsed.tags.GPSLongitude) {
					return {
						coordLat: numberRound(parsed.tags.GPSLatitude, 6),
						coordLon: numberRound(parsed.tags.GPSLongitude, 6),
					};
				}
			} catch (error) {
				if (error.message === 'Index out of range') {
					LOG.warning(extData.exifBuffer + ' bytes is too small buffer for loading EXIF from file "' + fullPath + '".');
				} else if (error.message === 'Invalid JPEG section offset') {
					// ignore, probably broken image and/or EXIF data, more info in https://github.com/bwindels/exif-parser/issues/13
				} else {
					LOG.error('Error while loading coordinates from EXIF for file "' + fullPath + '": ' + error);
				}
			}
			return {};
		}

		let files = [];
		globby(res.locals.fullPathFolder + '*', {onlyFiles: true}).then(function (rawPathsFiles) {
			rawPathsFiles.forEach(function (fullPath) {
				const dynamicPath = HFS.pathMakeDynamic(c.path, fullPath);
				if (perms.test(res.locals.userPerms, dynamicPath) === false) {
					return;
				}
				if (dynamicPath.match((new FileExtensionMapper).regexAll) === null) {
					return;
				}
				let pathStats = null;
				try {
					pathStats = FS.lstatSync(fullPath);
				} catch (error) {
					LOG.error('[Globby] Error while processing file: "' + fullPath + '": ' + error.message);
					return;
				}
				let fileItem = new FileItem(null, {
					path: dynamicPath,
					size: pathStats.size,
					created: pathStats.ctime,
				});
				// try to load coordinates from EXIF and merge them into path data
				fileItem = Object.assign(fileItem, getCoordsFromExifFromFile(fullPath));
				files.push(fileItem.serialize());
			});
			files.sort(sortItemsByPath);
			return resolve(files);
		}).catch(function (error) {
			LOG.error('[Globby] Error while processing files in "' + res.locals.fullPathFolder + '": ' + error.message);
			resolve([]);
		});
	});

	function generateSpecificFilePromise(filename) {
		return new Promise(function (resolve) {
			if (perms.test(res.locals.userPerms, res.locals.path + filename) === false) { // user dont have permission to this file
				return resolve(null);
			}
			FS.readFile(res.locals.fullPathFolder + filename, function (error, data) {
				if (error) {
					if (error.code !== 'ENOENT') { // some other error than just missing file
						LOG.error('Error while loading "' + res.locals.path + filename + '": ' + error)
					}
					return resolve(null)
				}
				resolve(data.toString());
			});
		});
	}

	Promise.all([
		loadFoldersPromise,
		loadFilesPromise,
		generateSpecificFilePromise('header.html'),
		generateSpecificFilePromise('footer.html'),
	]).then(function (data) {
		res.result.setResult({
			folders: data[0],
			files: data[1],
			header: data[2],
			footer: data[3]
		}).end();
	});
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
	}, webserver).listen(c.http.ssl.port, function() {
		LOG.info('(Webserver) Secured HTTPS server listening on port :' + c.http.ssl.port + '.');
	});
	// Start HTTP server to redirect all traffic to HTTPS
	http.createServer(function(req, res) {
		// if is used default port, dont add it at the end. URL starting with https is enough for browsers
		const newPort = (c.http.ssl.port === 443) ? '' : ':' + c.http.ssl.port;
		res.writeHead(301, {'Location': 'https://' + req.headers['host'].replace(new RegExp(':' + c.http.port + '$'), '') + newPort + req.url});
		res.end();
	}).listen(c.http.port, function() {
		LOG.info('(Webserver) Non-secured HTTP server listening on port :' + c.http.port + ' but all traffic will be automatically redirected to https.');
	});
} else {
	LOG.info('(Webserver) SSL is disabled, starting only HTTP server...');

	http.createServer(webserver).listen(c.http.port, function() {
		LOG.info('(Webserver) Non-secured HTTP server listening on port :' + c.http.port + '.');
	});
}
