require('./public/js/functions.js');
const c = require('./libs/config.js');
const log = require('./libs/log.js');
c.imageExtensions = Array.prototype.slice.call(c.imageExtensions);

c.compress.enabled = true;

var globby = require('globby');
var fs = require("fs");
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
log.log('***STARTING***');

log.log('Image compression is ' + ((c.compress.enabled) ? 'enabled' : 'disabled'));

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
 * Odhlaseni z googlu (smazani cookies)
 */
webserver.all('/logout', function (req, res) {
    res.clearCookie("googleLogin");
    res.redirect('/');
});

/**
 * Prihlaseni k googlu. Toto obstarava zaroven redirect NA i Z Google login stranky
 */
webserver.get('/login', function (req, res) {
    var code = req.query.code;
    if (code) {
        res.cookie('googleLogin', code, {maxAge: 900000});
    }
    if (code === undefined) {
        var url = oauth2Client.generateAuthUrl({
            access_type: 'offline', // will return a refresh token
            scope: 'email'
        });
        res.redirect(url);
    } else {
        code = code.replace('\\', '/'); // Bug, kdy lomitko v URL je normalni a v kodu zpetne (?!)
        oauth2Client.getToken(code, function (err, tokens) {
            if (err) {
                log.log('(Login) Chyba během získávání google tokenu: ' + err, log.ERROR);
                return res.status(500).send('Chyba behem ziskavani google tokenu. Zkus to <a href="/">znovu</a> nebo kontaktuj admina.<br><a href="/logout">Odhlasit</a>');
            }
            res.cookie('googleLogin', tokens.id_token, {maxAge: 900000});
            res.redirect('/');
        });
    }
});

webserver.all('*', function (req, res, next) {
    req.logged = false;
    var code = req.cookies.googleLogin;
    if (code) {
        oauth2Client.verifyIdToken(code, c.google.clientId, function (err, login) {
            if (err) {
                log.log('(Login) Chyba během ověřování google tokenu: ' + err, log.ERROR);
                return res.status(500).send('Chyba behem overovani google tokenu. Zkus to <a href="/">znovu</a> nebo kontaktuj admina.<br><a href="/logout">Odhlasit</a>');
            }
            var payload = login.getPayload();
            req.logged = payload.email;
            return next();
        });
    } else {
        return next();
    }
});

webserver.all('/api/[a-z]+', function (req, res, next) {
    var userPerms = perms.get('x');
    if (req.logged) {
        try { // K právům všech připojíme práva daného uživatele pokud existují
            var userPerms = perms.get(req.logged).concat(userPerms);
        } catch (e) {
        }
    }
    if (userPerms.indexOf('/') >= 0) { // Pokud má právo na celou složku, ostatní práva jsou zbytečná
        userPerms = ['/'];
    }
    console.log('User perms: ' + JSON.stringify(userPerms));
    req.userPerms = userPerms;
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
    next();
});
webserver.all('/api/image', function (req, res) {
    res.setHeader("Content-Type", "image/png");
    res.result.toString = function () {
        return './public/image-errors/' + this.message + '.png';
    };
    try {
        if (!req.query.path) {
            res.result.setError('neplatna-cesta');
            return fs.createReadStream('' + res.result).pipe(res);
        }

        var filePath = decodeURIComponent(Buffer.from(req.query.path, 'base64').toString());
        log.log('(Web) Request file: ' + filePath);
        res.statusCode = 200;

        // aby se nemohly vyhledavat soubory v predchozich slozkach
        var queryPath = filePath.replace('/..', '');

        var filePath = decodeURIComponent(c.path + queryPath).replaceAll('//', '/');
        var s = new Date();
        // @TODO return specific errors (not exists, not permissions etc) with specific statusCodes
        var fileStats = fs.lstatSync(filePath);
        if (fileStats.isFile()) {
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
//                    log.log('Compression takes: ' + ((new Date()) - s) + ' ms. Original size ' + Math.round(fileStats.size / 1024) + ' KB, compressed size ' + Math.round(fileStats.compressedSize / 1024) + ' KB and it is ' + fileStats.percent + '% smaller.');
//                    res.setHeader("Content-Length", fileStats.compressedSize);
//                    return res.end(img);
//                });
//            } else {
            return fs.createReadStream(filePath).pipe(res);
//            }
        }
    } catch (error) {
        res.statusCode = 404;
        res.result.setError('soubor-neexistuje');
        return fs.createReadStream('' + res.result).pipe(res);
    }
    //return res.end(apiResponse(apiResult));
});

webserver.get('/api/ping', function (req, res) {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    res.result.setResult(getUptime());
    res.end('' + res.result); // @HACK force toString()
});

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
 * loading list of folders and files
 */
webserver.get('/api/structure', function (req, res) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    if (!req.query.path) {
        res.result.setError('File - Není zadána cesta');
        return res.end('' + res.result); // @HACK force toString()
    }

    var folderPath = decodeURIComponent(Buffer.from(req.query.path, 'base64').toString());
    log.log('(Web) Request path: ' + folderPath);

    // aby se nemohly vyhledavat soubory v predchozich slozkach
    var queryPath = folderPath.replaceAll('/..', '');

    var globSearch = [
        sanatizePath((c.path + queryPath + '*/').replaceAll('//', '/')),
        sanatizePath((c.path + queryPath + "*.*").replaceAll('//', '/')),
    ];

    var re_extension = new RegExp('\\.(' + c.imageExtensions.join('|') + ')$', 'i');
    var folders = [];

    // if requested folder is not root add one item to go back
    if (queryPath !== '/') {
        var goBackPath = queryPath.split('/');
        goBackPath.splice(goBackPath.length - 2, 1); // remove last folder
        folders.push({
            path: goBackPath.join('/'),
            displayText: '..',
            displayIcon: 'level-up',
        });
    }

    var files = [];
    console.log('Loading folder structure started.');
    var t0 = new Date();
    globby(globSearch[0]).then(function (rawPathsFolders) {
        var t1 = new Date();
        console.log('Glob 1 done: ' + (t1 - t0) + 'ms.');
        globby(globSearch[1], {nodir: true}).then(function (rawPathsFiles) {
            var t2 = new Date();
            console.log('Glob 1 done: ' + (t2 - t1) + 'ms.');
            rawPaths = rawPathsFolders.concat(rawPathsFiles);
            rawPaths.forEach(function (path) {
                var pathStats = fs.lstatSync(path);
                path = path.replace(c.path, '');
                if (perms.test(req.userPerms, path)) {
                    var pathData = {
                        path: '/' + path
                    };
                    if (pathStats.isDirectory()) {
                        folders.push(pathData);
                    } else { // Filtrování pouze povolených souborů (dle přípony)
                        if (pathData.path.match(re_extension)) {
                            pathData.size = pathStats.size;
                            pathData.created = pathStats.ctime.human();
                            files.push(pathData);
                        }
                    }
                }
            });
            var t3 = new Date();
            console.log('Foreach done: ' + (t3 - t2) + 'ms.');
            console.log('Total time: ' + (t3 - t0) + 'ms.');
            log.log('(File) Nalezeno ' + folders.length + ' složek a ' + files.length + ' souborů.');
            res.result.setResult(folders.concat(files));
            res.end('' + res.result); // @HACK force toString()
        });
    });
});

webserver.listen(c.http.port, function () {
    log.log('(HTTP) Server listening on port ' + c.http.port);
});

function sanatizePath(path) {
    return path.replace(/(\.\.)|(^\/)/i, '');
}
