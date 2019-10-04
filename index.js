require('./public/js/functions.js');
const c = require('./libs/config.js');
const log = require('./libs/log.js');
const sha1 = require('sha1');
c.imageExtensions = Array.prototype.slice.call(c.imageExtensions);

c.compress.enabled = true;

var globby = require('globby');
var fs = require("fs");
const readdirp = require('readdirp');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
const perms = require('./libs/permissions.js');
var express = require('express');
var compression = require('compression');
var webserver = express();
webserver.use(bodyParser.json()); // support json encoded bodies
webserver.use(bodyParser.urlencoded({extended: true})); // support encoded bodies
webserver.use(cookieParser()); // support cookies
webserver.use(express.static('public'));
webserver.use(compression());

var google = require('googleapis');
var OAuth2Client = google.auth.OAuth2;
var plus = google.plus('v1');
var oauth2Client = new OAuth2Client(c.google.clientId, c.google.secret, c.google.redirectUrl);

//var sharp = require('sharp');
// TODO - potreba python
// http://sharp.pixelplumbing.com/en/stable/install/

const imagemin = require('imagemin');
const imageminJpegtran = require('imagemin-jpegtran');
const imageminPngquant = require('imagemin-pngquant');
const imageminJpegRecompress = require('imagemin-jpeg-recompress');

const start = new Date();
log.info('***STARTING***');

log.info('(Start) Image compression is ' + ((c.compress.enabled) ? 'enabled' : 'disabled'));
log.info('(Start) Defined base path is "' + c.path + '".');
try {
	let folderStats = fs.statSync(c.path);
	if (folderStats.isFile()) {
		throw 'it is file';
	}
} catch (error) {
	log.fatal('(Start) Error while checking defined path: ' + error);
}

function getUptime() {
	var diff = (new Date() - start);
	var response = {
		start: start.human(),
		uptime: {
			milliseconds: diff,
			human: msToHuman(diff)
		}
	}
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
	var weblog = '';
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
		if (!req.query.path) {
			throw 'Error: no path';
		}
		var queryPath = decodeURIComponent(Buffer.from(req.query.path, 'base64').toString());
		if (!perms.test(req.userPerms, queryPath)) {
			throw 'Error: no permission';
		}
		try {
			var fullQueryPath = (c.path + queryPath).replaceAll('//', '/');
			let fullQueryPathStats = fs.statSync(fullQueryPath);
			if (fullQueryPathStats.isFile()) {
				throw '';
			}
		} catch (error) {
			throw 'Error: invalid path';
		}

		var finds = {
			folders: [],
			files: []
		};
		// @HACK closing search by going folder back (not working in root)
		// @TODO just trigger hash change instead folder change
		var goBackPath = queryPath.split('/');
		goBackPath.splice(goBackPath.length - 2, 1); // remove last folder
		finds.folders.push({
//            path: goBackPath.join('/'),
			path: queryPath,
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

	var logPrefix = '(Web) Searching "' + req.query.query + '" in path "' + queryPath + '"';
	var readDirStart = new Date();

	readdirp(fullQueryPath, {type: 'files_directories', depth: 10, alwaysStat: false}).on('data', function (entry) {
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
	try {
		if (!req.query.path) {
			throw 'neplatna-cesta';
		}

		var filePath = decodeURIComponent(Buffer.from(req.query.path, 'base64').toString());

		if (!perms.test(req.userPerms, filePath)) {
			throw 'nemas-pravo';
		}

		res.statusCode = 200;

		// aby se nemohly vyhledavat soubory v predchozich slozkach
		var queryPath = filePath.replace('/..', '');

		var filePath = decodeURIComponent(c.path + queryPath).replaceAll('//', '/');
		var fileStats = fs.lstatSync(filePath);
		if (!fileStats.isFile()) {
			throw 'neni-soubor';
		}
		res.set("Content-Disposition", "inline;filename=" + queryPath.split('/').pop());
		log.info('(Web) Streaming file to download: ' + filePath);
		return fs.createReadStream(filePath).pipe(res);
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
 *
 * @returns image stream (in case of error, streamed image with error text)
 */
webserver.get('/api/image', function (req, res) {
	res.setHeader("Content-Type", "image/png");
	res.result.toString = function () {
		return './public/image-errors/' + this.message + '.png';
	};
	try {
		if (!req.query.path) {
			throw 'neplatna-cesta';
		}

		var filePath = decodeURIComponent(Buffer.from(req.query.path, 'base64').toString());
		log.info('(Web) Request file: ' + filePath);

		if (!perms.test(req.userPerms, filePath)) {
			throw 'nemas-pravo';
		}

		res.statusCode = 200;

		// aby se nemohly vyhledavat soubory v predchozich slozkach
		var queryPath = filePath.replace('/..', '');

		var filePath = decodeURIComponent(c.path + queryPath).replaceAll('//', '/');
		// @TODO return specific errors (not exists, not permissions etc) with specific statusCodes
		var fileStats = fs.lstatSync(filePath);
		if (!fileStats.isFile()) {
			throw 'neni-soubor';
		}
		// check if compression algorithm should run
//            if (c.compress.enabled && (fileStats.size >= c.compress.minLimit) && req.cookies['settings-compress'] === 'true') {
//                imagemin([filePath], {
//                    plugins: [
//                        imageminJpegRecompress(),
//                        imageminPngquant({quality: c.compress.pngQuality})
//                    ]
//                }).then(function (file) {
//                    var img = file[0].data;
//                    fileStats.compressedSize = img.length;
//                    fileStats.percent = 100 - ((fileStats.compressedSize / fileStats.size) * 100);
//                    fileStats.percent = Math.round(fileStats.percent * 100) / 100;
//                    log.info('Compression takes: ' + ((new Date()) - s) + ' ms. Original size ' + Math.round(fileStats.size / 1024) + ' KB, compressed size ' + Math.round(fileStats.compressedSize / 1024) + ' KB and it is ' + fileStats.percent + '% smaller.');
//                    res.setHeader("Content-Length", fileStats.compressedSize);
//                    return res.end(img);
//                });
//            } else {
		return fs.createReadStream(filePath).pipe(res);
//            }
	} catch (error) {
		res.statusCode = 404;
		res.result.setError('soubor-neexistuje');
		return fs.createReadStream('' + res.result).pipe(res);
	}
	//return res.end(apiResponse(apiResult));
});

/**
 * Stream video into browser
 *
 * @Author https://medium.com/better-programming/video-stream-with-node-js-and-html5-320b3191a6b6
 * @returns video stream
 */
webserver.get('/api/video', function (req, res) {
	res.setHeader("Content-Type", "image/png");
	res.result.toString = function () {
		return './public/image-errors/' + this.message + '.png';
	};
	if (!req.query.path) {
		throw 'neplatna-cesta';
	}

	var filePath = decodeURIComponent(Buffer.from(req.query.path, 'base64').toString());
	log.info('(Web) Request file: ' + filePath);

	if (!perms.test(req.userPerms, filePath)) {
		throw 'nemas-pravo';
	}

	res.statusCode = 200;

	// aby se nemohly vyhledavat soubory v predchozich slozkach
	var queryPath = filePath.replace('/..', '');

	var filePath = decodeURIComponent(c.path + queryPath).replaceAll('//', '/');

	var fileStats = fs.lstatSync(filePath);
	if (!fileStats.isFile()) {
		throw 'neni-soubor';
	}

	const stat = fs.statSync(filePath);
	const fileSize = stat.size;
	const range = req.headers.range;
	if (range) {
		const parts = range.replace(/bytes=/, "").split("-");
		const start = parseInt(parts[0], 10);
		const end = (parts[1] ? parseInt(parts[1], 10) : fileSize - 1);
		const chunksize = (end - start) + 1;
		const file = fs.createReadStream(filePath, {start, end});
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
		fs.createReadStream(filePath).pipe(res);
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
	if (!req.query.path) {
		res.result.setError('File - Není zadána cesta');
		return res.end('' + res.result); // @HACK force toString()
	}

	var folderPath = decodeURIComponent(Buffer.from(req.query.path, 'base64').toString());

	// aby se nemohly vyhledavat soubory v predchozich slozkach
	var queryPath = folderPath.replaceAll('/..', '');

	// check if loading path is folder (it also eliminate special characters as any char *)
	try {
		let queryPathStats = fs.statSync((c.path + queryPath).replaceAll('//', '/'));
		if (queryPathStats.isFile()) {
			throw '';
		}
	} catch (error) {
		res.result.setError('Neplatná cesta');
		res.end('' + res.result); // @HACK force toString()
		return;
	}

	var globSearch = [
		sanatizePath((c.path + queryPath + '*/').replaceAll('//', '/')),
		sanatizePath((c.path + queryPath + "*.*").replaceAll('//', '/')),
	];
	var re_extension = new RegExp('\\.(' + c.imageExtensions.concat(c.videoExtensions).concat(c.downloadExtensions).join('|') + ')$', 'i');

	var loadFoldersPromise = new Promise(function (resolve) {
		var folders = [];
		// if requested folder is not root add one item to go back
		if (queryPath !== '/') {
			var goBackPath = queryPath.split('/');
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
		var files = [];
		globby(globSearch[1], {nodir: true}).then(function (rawPathsFiles) {
			rawPathsFiles.forEach(function (path) {
				try {
					var pathStats = fs.lstatSync(path);
					path = path.replace(c.path, '/');
					if (perms.test(req.userPerms, path)) {
						var pathData = {
							path: path
						};
						if (!pathStats.isDirectory()) {
							if (pathData.path.match(re_extension)) {
								pathData.size = pathStats.size;
								pathData.created = pathStats.ctime;
								files.push(pathData);
							}
						}
					}
				} catch (error) {
					log.debug('[Globby] Cant get stats from file "' + path + '".');
				}
			});
			return resolve(files);
		});
	});

	Promise.all([loadFoldersPromise, loadFilesPromise]).then(function (data) {
		res.result.setResult({
			folders: data[0],
			files: data[1]
		});
		res.end('' + res.result); // @HACK force toString()
	});
});

// Start webserver server
webserver.listen(c.http.port, function () {
	log.info('(HTTP) Server listening on port ' + c.http.port);
});

function sanatizePath(path) {
	return path.replace(/(\.\.)|(^\/)/i, '');
}
