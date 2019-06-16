var c = require('./config');
var u = require('./myUtils.js');
var e = require('./enum.js');

c.imageExtensions = Array.prototype.slice.call(c.imageExtensions);

c.compressImage = true;

var globby = require('globby');
var fs = require("fs");
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');

var express = require('express');
var compression = require('compression');
var webserver = express();
webserver.use(bodyParser.json()); // support json encoded bodies
webserver.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
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

var start = new Date();
u.log('***STARTING***');

u.log('Image compression is ' + ((c.compressImage) ? 'enabled' : 'disabled'));

function getUptime(){
    var now = new Date();
    var diffMiliseconds = (now - start);

    var milliseconds = parseInt((diffMiliseconds%1000));
    var seconds = parseInt((diffMiliseconds/1000)%60);
    var minutes = parseInt((diffMiliseconds/(1000*60))%60);
    var hours = Math.floor(diffMiliseconds/(1000*60*60));

    var diffHuman = (((String(hours)).pad(2, '0', 'left') + ':' + String(minutes).pad(2, '0', 'left')) + ":" + String(seconds).pad(2, '0', 'left') + "." + String(milliseconds).pad(3, '0', 'left'));

    var response = {
        start: u.formatDateTime(start),
        end: u.formatDateTime(now),
        uptime: {
            milliseconds: diffMiliseconds,
            human: diffHuman
        }
    }
    return response;
}

fs.readFile(c.path + '.pmg_perms', 'utf8', function(err, data) {
    if (true || err) {
        u.log("Chyba při načítání .perm souboru: " + err);
    } else {
        try {
            var perms = {};
            var lines = data.split("\r\n");
            var indexes = [];
            lines.some(function(line) {
                if (line.match(/^#/)) { // Ignorujeme komentare
                } else if (line.trim() === '') { // zrušit indexy
                    indexes = [];
                } else if (!line.match(/^ /)) { // řádek nezačíná mezerou, je to tedy uživatel
                    indexes.push(line);
                    if (perms[line] === undefined) {
                        perms[line] = [];                
                    }
                } else {
                    indexes.some(function(index) {
                        perms[index].push(line.replace(/^ /, ''));
                    });
                }
            });
            u.log("Úspěšně naparsován .perms soubor");
            c.perms = perms;
        } catch (err) {
            u.log("Nepodarilo se naparsovat perm soubor: " + err);
        }
    }
    u.log('Perms: ' + JSON.stringify(c.perms));
});

webserver.all('/testdata', function (req, res) {
    res.setHeader("Content-Type", "application/json");
    res.setHeader('Access-Control-Allow-Origin', '*');
    var data = [];
    
    for (var floor = 0; floor < 2; floor++) {
        data[floor] = [];
        for (var room = 0; room < 6; room++) {
            data[floor].push({
                number: (room+200),
                light: (Math.random() > 0.5 ? true : false) ,
                window: (Math.random() > 0.5 ? true : false)
            });
        }
    }
    res.statusCode = 200;
    var result = {
        datetime: u.formatDateTime(new Date),
        error: false,
        result: data
    };
    res.end(u.apiResponse(result));
});


webserver.all('/ping', function (req, res) {
    res.setHeader("Content-Type", "application/json");
    res.statusCode = 200;
    var result = {
        datetime: u.formatDateTime(new Date),
        error: false,
        result: getUptime()
    };
    res.end(u.apiResponse(result));
});

webserver.get('/', function (req, res) {
    res.sendFile(__dirname + '/private/index.html');
});
webserver.all('/:type([a-zA-Z0-9-]+\.[a-z]+)', function(req, res) {
    var file = __dirname + '/private/' + req.params.type;
    console.log("searching file " + file);
    if (fs.existsSync(file)) {
        return res.sendfile(file);
    }
    return res.sendStatus(404);
});


/**
 * Odhlaseni z googlu (smazani cookies)
 */
webserver.all('/logout', function(req, res){
    res.clearCookie("googleLogin");
    res.redirect('/');
});

/**
 * Prihlaseni k googlu. Toto obstarava zaroven redirect NA i Z Google login stranky
 */
webserver.get('/login', function(req, res){
    var code = req.query.code;
    if (code) {
        res.cookie('googleLogin', code, { maxAge: 900000 });
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
                u.log('(Login) Chyba během získávání google tokenu: ' + err, e.LOG.ERROR);
                return res.status(500).send('Chyba behem ziskavani google tokenu. Zkus to <a href="/">znovu</a> nebo kontaktuj admina.<br><a href="/logout">Odhlasit</a>');
            }
            res.cookie('googleLogin', tokens.id_token, { maxAge: 900000 });
            res.redirect('/');
        });
    }
});

webserver.all('*', function(req, res, next) {
    req.logged = false;
    var code = req.cookies.googleLogin;
    if (code) {
        oauth2Client.verifyIdToken(code, c.google.clientId, function(err, login) {
            if (err) {
                u.log('(Login) Chyba během ověřování google tokenu: ' + err, e.LOG.ERROR);
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

webserver.all('*', function(req, res, next) {
    var userPerms = c.perms['x'];
    if (req.logged) {
        try { // K právům všech připojíme práva daného uživatele pokud existují
            var userPerms = c.perms[req.logged].concat(userPerms);
        } catch (e) { }
        if (userPerms.indexOf('/') >= 0) { // Pokud má právo na celou složku, ostatní práva jsou zbytečná
            userPerms = ['/'];
        }
    }
    req.userPerms = userPerms;
    return next();
});

webserver.all('/*.(' + c.imageExtensions.join('|') + ')', function (req, res) {
    u.log('(Web) Request file: ' + req.path);
    res.statusCode = 200;
    res.setHeader("Content-Type", "image/png");
//    res.setHeader("Content-Type", "application/json");
    var apiResult = {
        datetime: u.formatDateTime(new Date),
        error: true,
        result: 'File - Není zadána cesta'
    };
    if (!req.path) {
        res.end(apiResult);
    }

    // aby se nemohly vyhledavat soubory v predchozich slozkach
    var queryPath = req.path.replace('/..', '');

    var filePath = decodeURIComponent(c.path + queryPath).replaceAll('//', '/');
    try {
        var s = new Date();
        var fileStats = fs.lstatSync(filePath)
        if (fileStats.isFile()) {
            if (c.compressImage) {
                imagemin([filePath], {
                    plugins: [
                        imageminJpegRecompress(),
                        imageminPngquant({quality: '65-80'})
                    ]
                }).then(function(file) {
                    var img = file[0].data;
                    fileStats.compressedSize = img.length;
                    fileStats.percent = 100 - ((fileStats.compressedSize / fileStats.size) * 100);
                    fileStats.percent = Math.round(fileStats.percent * 100) / 100;
                    u.log('Compression takes: ' + ((new Date()) - s) + ' ms. Original size ' + Math.round(fileStats.size / 1024) + ' KB, compressed size ' + Math.round(fileStats.compressedSize / 1024) + ' KB and it is ' + fileStats.percent + '% smaller.');
                    res.setHeader("Content-Length", fileStats.compressedSize);
                    return res.end(img);
                });
            } else {
                return fs.createReadStream(filePath).pipe(res);            
            }
        }
    } catch (error) {
        res.statusCode = 404;
    }
    //return res.end(u.apiResponse(apiResult));
});

function checkPerm (path, perms){
    var result = false;
    perms.some(function(perm) {
        if (perm.match('/' + path) || ('/' + path).match(perm)) {
            return result = true;
        }
    });
    return result;
}


webserver.post('/*', function (req, res) {
    u.log('(Web) Request path: ' + req.body.path);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    var apiResult = {
        datetime: u.formatDateTime(new Date),
        error: true,
        result: 'Folder - Není zadána cesta'
    };
    if (!req.body.path) {
        res.end(u.apiResponse(apiResult));
    }

    // aby se nemohly vyhledavat soubory v predchozich slozkach
    var queryPath = req.body.path.replace('/..', '');
    
    var globSearch = [
        sanatizePath(decodeURIComponent(c.path + queryPath + '*/').replaceAll('//', '/')),
        sanatizePath(decodeURIComponent(c.path + queryPath + "*.*").replaceAll('//', '/')),
    ];
    
    var re_extension = new RegExp('\\.(' + c.imageExtensions.join('|') + ')$', 'i');
    var folders = [];
    var files = [];
    globby(globSearch[0]).then(function(rawPathsFolders) {
        globby(globSearch[1], {nodir: true}).then(function(rawPathsFiles) {
            rawPaths = rawPathsFolders.concat(rawPathsFiles);
            rawPaths.forEach(function(path) {
                var pathStats = fs.lstatSync(path);
                path = path.replace(c.path, '');
                if (checkPerm(path, req.userPerms)) {
                    var pathData = {
                        path: path.replace(/\/$/, ''),
                    };
                    if (pathStats.isDirectory()) {
                        folders.push(pathData);
                    } else { // Filtrování pouze povolených souborů (dle přípony)
                        if (pathData.path.match(re_extension)) {
                            pathData.size = pathStats.size;
                            pathData.created = u.formatDateTime(pathStats.ctime);
                            files.push(pathData);
                        }
                    }
                }
            });
            u.log('(File) Nalezeno ' + folders.length + ' složek a ' + files.length + ' souborů.');
            apiResult.error = false;
            apiResult.result = folders.concat(files);
            res.end(u.apiResponse(apiResult));
        });
    });
});

webserver.get('/killllll', function (req, res) {
    console.log('killl');
    res.end('killed');
    process.exit();
});

webserver.listen(c.httpServerPort, function () {
    u.log('(HTTP) Server listening on port ' + c.httpServerPort);
});



function sanatizePath(path) {
    return path.replace(/(\.\.)|(^\/)/i, '');
}