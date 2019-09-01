require('./public/js/functions.js');
const c = require('./libs/config.js');
const log = require('./libs/log.js');
const sha1 = require('sha1');
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
 * Middleware pro veškeré requesty
 * - logování
 */
webserver.all('*', function (req, res, next) {
    var weblog = '';
    weblog += '[' + req.ip + ']';
    weblog += '[' + req.method + ',' + req.protocol + ']';
    weblog += '[' + req.path + ']';
    weblog += '[GET:' + JSON.stringify(req.query) + ']';
    weblog += '[POST:' + JSON.stringify(req.body) + ']';
    log.log(weblog, log.WEBSERVER);
    return next();
});

/**
 * Odhlaseni z googlu (smazani cookies)
 */
webserver.get('/logout', function (req, res) {
    res.clearCookie(c.http.login.name);
    res.redirect('/');
});

/**
 * Prihlaseni k googlu. Toto obstarava zaroven redirect NA i Z Google login stranky
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
            log.log('(Login) Chyba během získávání google tokenu: ' + errGetToken + '. Vice info v debug logu.', log.ERROR);
            try {
                log.log('(Login) ' + JSON.stringify(response), log.DEBUG);
            } catch (error) {
                log.log('(Login) Chyba během parsování response u získávání google tokenu.', log.DEBUG);
            }
            res.status(500).send('Chyba behem ziskavani google tokenu. Zkus to <a href="/login">znovu</a> nebo kontaktuj admina.<br><a href="/logout">Odhlasit</a>');
            return;
        }
        // Overeni ziskaneho tokenu (pro ziskani emailu)
        oauth2Client.verifyIdToken(tokens.id_token, c.google.clientId, function (errVerifyToken, login) {
            if (errVerifyToken) {
                log.log('(Login) Chyba během ověřování google tokenu: ' + errVerifyToken, log.ERROR);
                res.status(500).send('Chyba behem ziskavani google tokenu. Zkus to <a href="/login">znovu</a> nebo kontaktuj admina.<br><a href="/logout">Odhlasit</a>');
                return;
            }
            // Zjisteni informaci o uzivateli od Google
            var payload = login.getPayload();
            log.log('(Login) Logged user "' + payload.email + '".');
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

webserver.get('/api/[a-z]+', function (req, res, next) {
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
    // Load default user permissions
    var userPerms = perms.get('x');
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
        // load logged user permissions and merge with default
        userPerms = perms.get(cookieContent.email).concat(userPerms);

        // Aktualizujeme platnost cookies
        fs.utimesSync(cookieFilePath, new Date(), new Date());
    } catch (error) {
        res.clearCookie(c.http.login.name);
    }
    if (userPerms.indexOf('/') >= 0) { // Pokud má právo na celou složku, ostatní práva jsou zbytečná
        userPerms = ['/'];
    }
    console.log('User perms: ' + JSON.stringify(userPerms));
    req.userPerms = userPerms;
    next();
});

webserver.get('/api/download', function (req, res) {
    try {
        if (!req.query.path) {
            throw 'neplatna-cesta';
        }

        var filePath = decodeURIComponent(Buffer.from(req.query.path, 'base64').toString());
        log.log('(Web) Request file: ' + filePath);

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
        return fs.createReadStream(filePath).pipe(res);
    } catch (error) {
        res.statusCode = 404;
        res.result.setError('soubor-neexistuje');
        res.end('' + res.result);
    }
});

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
        log.log('(Web) Request file: ' + filePath);

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
//                    log.log('Compression takes: ' + ((new Date()) - s) + ' ms. Original size ' + Math.round(fileStats.size / 1024) + ' KB, compressed size ' + Math.round(fileStats.compressedSize / 1024) + ' KB and it is ' + fileStats.percent + '% smaller.');
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

webserver.get('/api/video', function (req, res) {
    res.setHeader("Content-Type", "image/png");
    res.result.toString = function () {
        return './public/image-errors/' + this.message + '.png';
    };
    if (!req.query.path) {
        throw 'neplatna-cesta';
    }

//    var filePath = decodeURIComponent(c.path + queryPath).replaceAll('//', '/');
    var filePath = decodeURIComponent(Buffer.from(req.query.path, 'base64').toString());
    log.log('(Web) Request file: ' + filePath);

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

    const stat = fs.statSync(filePath)
    const fileSize = stat.size
    const range = req.headers.range
    if (range) {
        const parts = range.replace(/bytes=/, "").split("-")
        const start = parseInt(parts[0], 10)
        const end = parts[1]
                ? parseInt(parts[1], 10)
                : fileSize - 1
        const chunksize = (end - start) + 1
        const file = fs.createReadStream(filePath, {start, end})
        const head = {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4',
        }
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = {
            'Content-Length': fileSize,
            'Content-Type': 'video/mp4',
        }
        res.writeHead(200, head)
        fs.createReadStream(filePath).pipe(res)
    }
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
    console.log("structure done");
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

    var re_extension = new RegExp('\\.(' + c.imageExtensions.concat(c.videoExtensions).join('|') + ')$', 'i');
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
            res.end('' + res.result);
        });
    });
});

webserver.listen(c.http.port, function () {
    log.log('(HTTP) Server listening on port ' + c.http.port);
});

function sanatizePath(path) {
    return path.replace(/(\.\.)|(^\/)/i, '');
}
