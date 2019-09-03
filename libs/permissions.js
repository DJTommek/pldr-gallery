var c = require('./config.js');
var fs = require("fs");
var log = require('./log.js');

var permissions = {};

function loadPermissions(callback) {
    fs.readFile(c.path + '.pmg_perms', 'utf8', function (err, data) {
        if (err) {
            return (typeof callback === 'function' && callback("Chyba při načítání .perm souboru: " + err));
        } else {
            try {
                var perms = {};
                var lines = data.split("\r\n");
                var indexes = [];
                lines.some(function (line) {
                    if (line.match(/^#/)) { // Ignorujeme komentare
                    } else if (line.trim() === '') { // zrušit indexy
                        indexes = [];
                    } else if (!line.match(/^ /)) { // řádek nezačíná mezerou, je to tedy uživatel
                        indexes.push(line);
                        if (perms[line] === undefined) {
                            perms[line] = [];
                        }
                    } else {
                        indexes.some(function (index) {
                            perms[index].push(line.trim());
                        });
                    }
                });
                permissions = perms;
                return (typeof callback === 'function' && callback(false));
            } catch (err) {
                return (typeof callback === 'function' && callback("Nepodarilo se naparsovat perm soubor: " + err));
            }
        }
    });
}

exports.test = function (perms, path) {
    var result = false;
    perms.some(function (perm) {
        if (
                (path).indexOf(perm) === 0
                ||
                (perm.indexOf(path)) === 0
                ) {
            return result = true;
        }
    });
    return result;
}

exports.get = function (username) {
    var perms = permissions[username];
    return ((perms) ? perms : []);
}

exports.reload = function (callback) {
    log.log("(Permissions) Reloading permissions");
    loadPermissions(function (error) {
        if (error) {
            log.log(error, log.ERROR);
            return (typeof callback === 'function' && callback(error));
        } else {
            log.log('Permissions loaded: ' + JSON.stringify(permissions));
            return (typeof callback === 'function' && callback(false));
        }
    });
}

loadPermissions(function (error) {
    if (error) {
        log.log(error, log.ERROR);
    } else {
        log.log('Permissions loaded: ' + JSON.stringify(permissions));
    }
});
