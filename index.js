/* global Promise, decodeURIComponent */
require('./public/js/functions.js');
const c = require('./libs/config.js');
const log = require('./libs/log.js');
const sha1 = require('sha1');
c.imageExtensions = Array.prototype.slice.call(c.imageExtensions);

const globby = require('globby');
const fs = require("fs");
const path = require('path');
const readdirp = require('readdirp');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const perms = require('./libs/permissions.js');
const express = require('express');
const compression = require('compression');
const webserver = express();
webserver.use(bodyParser.json()); // support json encoded bodies
webserver.use(bodyParser.urlencoded({extended: true})); // support encoded bodies
webserver.use(cookieParser()); // support cookies
webserver.use(express.static('public'));
webserver.use(compression());

const exifParser = require('exif-parser');

const google = require('googleapis');
const oauth2Client = new google.auth.OAuth2(c.google.clientId, c.google.secret, c.google.redirectUrl);

const sharp = require('sharp');

const start = new Date();
log.info('***STARTING***');

try {
	let folderStats = fs.statSync(c.path);
	if (folderStats.isFile()) {
		throw 'it is file';
	}
	let items = fs.readdirSync(c.path);
	if (items.length === 0) {
		throw 'No items in base folder.';
	}
	log.info('(Start) Defined base path "' + c.path + '" is valid with "' + items.length + '" items.');
} catch (error) {
	log.fatal('(Start) Defined base path "' + c.path + '" is invalid. Error: ' + error);
}

function getUptime() {
	const diff = (new Date() - start);
	const response = {
		start: start.human(),
		uptime: {
			milliseconds: diff,
			human: msToHuman(diff)
		}
	};
	return response;
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
	log.webserver(weblog);

	res.result = {
		datetime: (new Date).human(),
		error: true,
		message: '',
		result: [],
		setError: function (text) {
			this.error = true;
			this.message = text;
			this.result = [];
		}, setResult: function (result, message) {
			this.error = false;
			this.result = result;
			if (message) {
				this.message = message;
			}
		}, toString: function () {
			return JSON.stringify(this, null, 4);
		}
	};
	return next();
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
	var code = req.query.code;
	// Neprihlaseny uzivatel (nema cookie) se dozaduje prihlaseni, zjistime pro nej
	// Google prihlasovaci URL a presmerujeme jej na ni. Po uspesnem prihlaseni
	// se vrati req.code
	if (code === undefined) {
		var url = oauth2Client.generateAuthUrl({
			scope: 'email'
		});
		res.redirect(url);
		return;
	} else {
		code = code.replace('\\', '/'); // Bug, kdy lomitko v URL je normalni a v kodu zpetne (?!)
	}
	// Google uzivatele presmeroval zpet sem se schvalenym loginem.
	// Zkontrolujeme vraceny code a pokud je ok, hash token_id ziskany z code
	// ulozime jako cookie a vytvorime soubor, kam ulozime udaje o uzivateli
	oauth2Client.getToken(code, function (errGetToken, tokens, response) {
		if (errGetToken) {
			log.error('(Login) Chyba během získávání google tokenu: ' + errGetToken + '. Vice info v debug logu.');
			try {
				log.debug('(Login) ' + JSON.stringify(response));
			} catch (error) {
				log.debug('(Login) Chyba během parsování response u získávání google tokenu.');
			}
			res.status(500).send('Chyba behem ziskavani google tokenu. Zkus to <a href="/login">znovu</a> nebo kontaktuj admina.<br><a href="/logout">Odhlasit</a>');
			return;
		}
		// Overeni ziskaneho tokenu (pro ziskani emailu)
		oauth2Client.verifyIdToken(tokens.id_token, c.google.clientId, function (errVerifyToken, login) {
			if (errVerifyToken) {
				log.error('(Login) Chyba během ověřování google tokenu: ' + errVerifyToken);
				res.status(500).send('Chyba behem ziskavani google tokenu. Zkus to <a href="/login">znovu</a> nebo kontaktuj admina.<br><a href="/logout">Odhlasit</a>');
				return;
			}
			// Zjisteni informaci o uzivateli od Google
			var payload = login.getPayload();
			log.info('(Login) Logged user "' + payload.email + '".');
			var tokenHash = sha1(tokens.id_token + c.authSalt);
			var userData = {
				logged_time: new Date().getTime(),
				token_id: tokens.id_token,
				token_hash: tokenHash,
				ip: req.ip,
				email: payload.email
			};

			fs.writeFileSync(c.http.login.tokensPath + tokenHash + '.txt', JSON.stringify(userData), 'utf8');
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
	var userPerms = perms.getUser('x');
	// Try load perms for logged user
	try {
		var token = req.cookies[c.http.login.name];

		// Cookie neni nebo neni platna
		if (!token || !token.match("^[a-f0-9]{40}$")) {
			throw 'Musis se <a href="/login">prihlasit</a>.';
		}
		var cookieFilePath = c.http.login.tokensPath + token + '.txt';
		// Existuje cookie i na serveru?
		if (!fs.existsSync(cookieFilePath)) {
			throw 'Cookie na serveru neexistuje, musis se znovu <a href="/login">prihlasit</a>.';
		}
		// Je cookie na serveru stale platna?
		var fileStats = fs.statSync(cookieFilePath);
		// Pokud je diff zaporny, cookie je starsi nez je povolene
		var diff = (fileStats.atime.getTime() + c.http.login.validity) - new Date().getTime();
		if (diff < 0) {
			throw 'Platnost cookie vyprsela, musis se znovu <a href="/login">prihlasit</a>.';
		}
		// Vše je v pořádku
		var cookieContent = JSON.parse(fs.readFileSync(cookieFilePath));

		req.user = cookieContent.email;
		// load logged user permissions and merge with default user permissions
		userPerms = perms.getUser(cookieContent.email).concat(userPerms);

		// Aktualizujeme platnost cookies
		fs.utimesSync(cookieFilePath, new Date(), new Date());
	} catch (error) {
		res.clearCookie(c.http.login.name);
	}
	// Try load perms if user has some passwords
	try {
		var passwordCookie = req.cookies['pmg-passwords'];
		if (!passwordCookie) {
			throw 'No password cookie is available';
		}
		var passwordsCookie = passwordCookie.split(',');
		passwordsCookie.forEach(function (pass) {
			userPerms = perms.getPass(pass).concat(userPerms);
		});
	} catch (error) {
		// Do nothing, probably just dont have cookie
	}
	if (userPerms.indexOf('/') >= 0) { // Pokud má právo na celou složku, ostatní práva jsou zbytečná
		userPerms = ['/'];
	}
	req.userPerms = userPerms;

	log.info('(Web) Api access ' + req.path + ', user ' + (req.user ? req.user : 'x'));

	// Parse, sanatize and check permissions for path if defined
	if (req.query.path) {
		let queryPath = req.query.path;
		try {
			// base64 decode
			queryPath = decodeURIComponent(Buffer.from(queryPath, 'base64').toString());
			// fix relative parts (.. and .) and convert to forward slashes (default for Linux but it should be compatible with Windows too)
			queryPath = path.normalize(queryPath).replaceAll('\\', '/');
			res.locals.queryPath = queryPath;
			// check permissions
			if (!perms.test(req.userPerms, queryPath)) {
				throw 'User do not have permissions to path"' + queryPath + '"'; // user dont have permission to this path
			}
			var fullPath = path.join(c.path, queryPath).replaceAll('\\', '/');
			// Check if path exists
			var fileStats = fs.lstatSync(fullPath); // throws exception if not exists or not accessible
			// requested path wants folder
			if (fullPath.match(/\/$/)) {
				if (fileStats.isDirectory()) {
					res.locals.fullPathFolder = fullPath;
				} else {
					throw 'Requested path "' + queryPath + '" is not folder';
				}
			} else { // Requested path wants file
				if (fileStats.isFile()) {
					res.locals.fullPathFile = fullPath;
				} else {
					throw 'Requested path "' + queryPath + '" is not file';
				}
			}
			res.locals.path = queryPath;
		} catch (error) {
			// log to debug because anyone can generate invalid paths
			log.debug('(Web) Requested invalid path "' + req.query.path + '", error: ' + error + '.');
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
	try {
		if (!req.query.query) {
			throw 'Error: no search input';
		}
		if (!res.locals.fullPathFolder) {
			throw 'Error: no path';
		}

		var finds = {
			folders: [],
			files: []
		};
		// @HACK closing search by going folder back (not working in root)
		// @TODO just trigger hash change instead folder change
		var goBackPath = res.locals.path.split('/');
		goBackPath.splice(goBackPath.length - 2, 1); // remove last folder
		finds.folders.push({
//            path: goBackPath.join('/'),
			path: res.locals.path,
			noFilter: true,
			displayText: 'Zavřít vyhledávání "' + req.query.query + '"',
			displayIcon: 'long-arrow-left'
		});

		// Do not use readdirp.fileFilter option because is case sensitive.
		// Instead create custom file extensions regex with case-insensitive parameter
		// Closed github request, Option for case-insensitive filter: https://github.com/paulmillr/readdirp/issues/47
		var fileExtRe = new RegExp('\.(' + c.imageExtensions.concat(c.videoExtensions).concat(c.downloadExtensions).join('|') + ')$', 'i');

	} catch (error) {
		res.result.setError('' + error); // @HACK force toString()
		res.end('' + res.result); // @HACK force toString()
	}

	var logPrefix = '(Web) Searching "' + req.query.query + '" in path "' + res.locals.path + '"';
	var readDirStart = new Date();

	readdirp(res.locals.fullPathFolder, {type: 'files_directories', depth: 10, alwaysStat: false}).on('data', function (entry) {
		try {
			if (!entry.dirent.isDirectory() && !entry.basename.match(fileExtRe)) {
				return; // not directory or not match allowed extension
			}
			var path = entry.fullPath.replace(/\\/g, '/').replace(c.path, '/'); // all folder separators has to be /
			if (entry.basename.toLowerCase().indexOf(req.query.query.toLowerCase()) === -1) {
				return; // not match with searched query
			}
			if (!perms.test(req.userPerms, path)) {
				return; // user dont have permission to this item
			}
			var pathData = {
				path: path,
				displayText: path
			};
			if (entry.dirent.isDirectory()) {
				pathData.path += '/';
				finds.folders.push(pathData);
			} else { // is file, load detailed info
				var pathStats = fs.lstatSync(entry.fullPath);
				pathData.size = pathStats.size;
				pathData.created = pathStats.ctime;
				finds.files.push(pathData);
			}
		} catch (error) {
			log.error(logPrefix + ' throwed error while processing readdirp results: ' + error);
		}
	}).on('warn', function (warning) {
		// @TODO - is emited "end" to send user response?
		log.error(logPrefix + ' throwed warning: ' + warning);
	}).on('error', function (error) {
		// @TODO - is emited "end" to send user response?
		log.error(logPrefix + ' throwed error: ' + error);
	}).on('end', function () {
		let humanTime = msToHuman(new Date() - readDirStart);
		log.info(logPrefix + ' is done in ' + humanTime + ', founded ' + finds.folders.length + ' folders and ' + finds.files.length + ' files.');
		res.result.setResult(finds, 'Done in ' + humanTime);
		res.end('' + res.result); // @HACK force toString()
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
			throw 'neplatna-cesta';
		}
		res.set('Content-Disposition', 'inline;filename="' + res.locals.fullPathFile.split('/').pop() + '"');
		log.info('(Web) Streaming file to download: ' + res.locals.fullPathFile);
		return fs.createReadStream(res.locals.fullPathFile).pipe(res);
	} catch (error) {
		res.statusCode = 404;
		res.result.setError('soubor-neexistuje');
		res.end('' + res.result); // @HACK force toString()
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
	try {
		var passwordCookie = req.cookies['pmg-passwords'];
		// If no password parameter is set, return list of all passwords
		if (!req.query.password) {
			let passwordPerms = [];
			if (passwordCookie) {
				let passwordsCookie = passwordCookie.split(',');
				passwordsCookie.forEach(function (password) {
					passwordPerms.push({
						password: password,
						permissions: perms.getPass(password)
					});
				});
			}
			res.result.setResult(passwordPerms, 'List of saved passwords.');
			res.end('' + res.result); // @HACK force toString()
			return;
		}
		// Passsword parameter is set. Check, if there are any permission to this cookie
		var passwordPerms = perms.getPass(req.query.password);
		if (passwordPerms.length === 0) {
			throw 'Invalid password.';
		}
		// Password is valid, save it into cookie (or create it if not set before)
		if (passwordCookie) {
			let passwordsCookie = passwordCookie.split(',');
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
			// @TODO - if permission is not folder but some prefix, it will make error in frontend. Possible ways to fix:
			// - do check, if permission string ends with "/"
			// - do real check, if that folder exists
			res.cookie('pmg-redirect', passwordPerms[0], {expires: new Date(253402300000000)});
			res.redirect('/');
		}
	} catch (error) {
		res.result.setError(error);
	}
	res.end('' + res.result); // @HACK force toString()
});

/**
 * Stream image.
 * Image can be compressed via cookie. This can be overriden via GET compress=true or false
 *
 * @returns image stream (in case of error, streamed image with error text)
 */
webserver.get('/api/image', function (req, res) {
	res.statusCode = 200;
	res.setHeader("Content-Type", "image/png");
	res.result.toString = function () {
		return './public/image-errors/' + this.message + '.png';
	};
	try {
		if (!res.locals.fullPathFile) {
			throw 'neplatna-cesta';
		}
		let imageStream = fs.createReadStream(res.locals.fullPathFile);
		if ((req.cookies['pmg-compress'] === 'true' && req.query.compress !== 'false') || req.query.compress === 'true') {
			imageStream = imageStream.pipe(sharp().resize(c.compress));
		}
		return imageStream.pipe(res);
	} catch (error) {
		// @TODO return proper errors
		res.statusCode = 404;
		res.result.setError('soubor-neexistuje');
		return fs.createReadStream('' + res.result).pipe(res);
	}
});

/**
 * Stream video into browser
 *
 * @Author https://medium.com/better-programming/video-stream-with-node-js-and-html5-320b3191a6b6
 * @returns video stream
 */
webserver.get('/api/video', function (req, res) {
	res.statusCode = 200;
	try {
		if (!res.locals.fullPathFile) {
			throw 'Invalid video path'
		}
		const stat = fs.statSync(res.locals.fullPathFile);
		const fileSize = stat.size;
		const range = req.headers.range;
		if (range) {
			const parts = range.replace(/bytes=/, "").split("-");
			const start = parseInt(parts[0], 10);
			const end = (parts[1] ? parseInt(parts[1], 10) : fileSize - 1);
			const chunksize = (end - start) + 1;
			const file = fs.createReadStream(res.locals.fullPathFile, {start, end});
			const head = {
				'Content-Range': `bytes ${start}-${end}/${fileSize}`,
				'Accept-Ranges': 'bytes',
				'Content-Length': chunksize,
				'Content-Type': 'video/mp4'
			};
			res.writeHead(206, head);
			file.pipe(res);
		} else {
			const head = {
				'Content-Length': fileSize,
				'Content-Type': 'video/mp4'
			};
			res.writeHead(200, head);
			fs.createReadStream(res.locals.fullPathFile).pipe(res);
		}
	} catch (error) {
		res.statusCode = 404;
		res.result.setError('File - Zadaná cesta není platná');
		res.end('' + res.result); // @HACK force toString()

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
		if (!req.user) { // is logged (it means cookie is valid)
			throw 'Not logged in.';
		}
		var token = req.cookies[c.http.login.name];
		try {
			// remove cookie from server file
			fs.unlinkSync(c.http.login.tokensPath + token + '.txt');
		} catch (error) {
			log.error('Cant delete token "' + token + '". ' + error);
			throw 'Cant delete token. More info in log.';
		}
		res.result.setResult('Cookie was deleted');
	} catch (error) {
		res.result.setError(error.message || error);
	}
	res.clearCookie(c.http.login.name); // send request to browser to remove cookie
	res.end('' + res.result); // @HACK force toString()
});

/**
 * Show uptime data
 *
 * @returns JSON
 */
webserver.get('/api/ping', function (req, res) {
	res.setHeader("Content-Type", "application/json");
	res.statusCode = 200;
	res.result.setResult(getUptime());
	res.end('' + res.result); // @HACK force toString()
});

/**
 * Save reports (errors, feedback, etc)
 *
 * @returns JSON
 */
webserver.post('/api/report', function (req, res) {
	res.setHeader("Content-Type", "application/json");
	res.statusCode = 200;
	var msg = '(Report) User "' + (req.user ? req.user : 'x') + '" is reporting ';
	if (req.body.type && req.body.type.match(/^[a-zA-Z0-9_\-.]{1,20}$/) && req.body.raw) {
		switch (req.body.type) {
			case 'javascript':
				log.error(msg += 'javascript error:\n' + req.body.raw);
				break;
			default:
				log.debug(msg += 'type="' + req.body.type + '":\n"' + req.body.raw + '".');
				break;
		}
		res.result.setResult(null, 'Report saved');
	} else {
		res.result.setError('Invalid "type" or "raw" POST data');
	}
	res.end('' + res.result); // @HACK force toString()
});

/**
 * Kill server
 *
 * @returns JSON
 */
webserver.get('/api/kill', function (req, res) {
	res.setHeader("Content-Type", "application/json");

	if (req.query.password !== c.test.password) {
		res.result.setError('Wrong password');
		return res.end('' + res.result); // @HACK force toString()
	}
	res.result.setResult(null, 'Kill requested in 2 seconds.');
	res.end('' + res.result); // @HACK force toString()
	log.head('(Web) Server is going to kill');
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
		res.result.setError('Zadaná cesta "<b>' + res.locals.queryPath + '</b>" není platná nebo na ni nemáš právo.');
		res.end('' + res.result); // @HACK force toString()
		return;
	}

	var globSearch = [
		res.locals.fullPathFolder + '*/',
		res.locals.fullPathFolder + '*.*',
	];
	var re_extension = new RegExp('\\.(' + c.imageExtensions.concat(c.videoExtensions).concat(c.downloadExtensions).join('|') + ')$', 'i');

	var loadFoldersPromise = new Promise(function (resolve) {
		var folders = [];
		// if requested folder is not root add one item to go back
		if (res.locals.path !== '/') {
			var goBackPath = res.locals.path.split('/');
			goBackPath.splice(goBackPath.length - 2, 1); // remove last folder
			folders.push({
				path: goBackPath.join('/'),
				displayText: '..',
				noFilter: true,
				displayIcon: 'level-up',
			});
		}
		globby(globSearch[0]).then(function (rawPathsFolders) {
			rawPathsFolders.forEach(function (path) {
				try {
					var pathStats = fs.lstatSync(path);
					path = path.replace(c.path, '/');
					if (perms.test(req.userPerms, path)) {
						var pathData = {
							path: path
						};
						if (pathStats.isDirectory()) {
							folders.push(pathData);
						}
					}
				} catch (error) {
					log.debug('[Globby] Cant get stats from folder "' + path + '".');
				}
			});
			resolve(folders);
		});
	});

	var loadFilesPromise = new Promise(function (resolve) {

		function getCoordsFromExifFromFile(fullPath) {
			try {
				if (!fullPath.match(new RegExp('\.(' + c.exifExtensions.join('|') + ')$', 'i'))) {
					return {};
				}
				// create small buffer, fill it with first x bytes from image and parse
				let exifBuffer = new Buffer.alloc(c.exifBufferSize);
				fs.readSync(fs.openSync(fullPath, 'r'), exifBuffer, 0, c.exifBufferSize, 0);
				let parsed = exifParser.create(exifBuffer).parse();
				if (parsed.tags.GPSLatitude && parsed.tags.GPSLatitude) {
					return {
						coordLat: Math.round(parsed.tags.GPSLatitude * 1000000) / 1000000,
						coordLon: Math.round(parsed.tags.GPSLongitude * 1000000) / 1000000,
					};
				}
			} catch (error) {
				if (error.message === 'Index out of range') {
					log.warning(c.exifBufferSize + ' bytes is too small buffer for loading EXIF from file "' + fullPath + '".');
				} else if (error.message === 'Invalid JPEG section offset') {
					// ignore, probably broken image and/or EXIF data, more info in https://github.com/bwindels/exif-parser/issues/13
				} else {
					log.error('Error while loading coordinates from EXIF for file "' + fullPath + '": ' + error);
				}
			}
			return {};
		}

		var files = [];
		globby(globSearch[1], {nodir: true}).then(function (rawPathsFiles) {
			rawPathsFiles.forEach(function (fullPath) {
				try {
					let pathStats = fs.lstatSync(fullPath);
					let dynamicPath = fullPath.replace(c.path, '/');
					if (perms.test(req.userPerms, dynamicPath)) {
						if (pathStats.isFile() && dynamicPath.match(re_extension)) {
							let pathData = {
								path: dynamicPath,
								size: pathStats.size,
								created: pathStats.ctime,
							};
							pathData = Object.assign(pathData, getCoordsFromExifFromFile(fullPath));
							files.push(pathData);
						}
					}
				} catch (error) {
					log.error('[Globby] Cant get stats from file "' + path + '": ' + error);
				}
			});
			return resolve(files);
		});
	});

	var loadHeaderPromise = new Promise(function (resolve) {
		if (!perms.test(req.userPerms, res.locals.path + 'header.html')) { // user dont have permission to this header (or folder)
			return resolve(null);
		}
		fs.readFile(res.locals.fullPathFolder + 'header.html', function (error, data) {
			if (error) {
				if (error.code !== 'ENOENT') { // some other error than just missing file
					log.error('Error while loading "' + res.locals.path + 'header.html' + '": ' + error)
				}
				return resolve(null)
			}
			resolve(data.toString());
		});
	});

	var loadFooterPromise = new Promise(function (resolve) {
		if (!perms.test(req.userPerms, res.locals.path + 'footer.html')) { // user dont have permission to this footer (or folder)
			return resolve(null);
		}
		fs.readFile(res.locals.fullPathFolder + 'footer.html', function (error, data) {
			if (error) {
				if (error.code !== 'ENOENT') { // some other error than just missing file
					log.error('Error while loading "' + req.locals.path + 'footer.html' + '": ' + error)
				}
				return resolve(null)
			}
			resolve(data.toString());
		});
	});

	Promise.all([loadFoldersPromise, loadFilesPromise, loadHeaderPromise, loadFooterPromise]).then(function (data) {
		res.result.setResult({
			folders: data[0],
			files: data[1],
			header: data[2],
			footer: data[3]
		});
		res.end('' + res.result); // @HACK force toString()
	});
});

// Start webserver server
webserver.listen(c.http.port, function () {
	log.info('(HTTP) Server listening on port ' + c.http.port);
});
