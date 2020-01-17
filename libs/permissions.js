const CONFIG = require('./config.js');
const FS = require("fs");
const LOG = require('./log.js');

var users = {};
var passwords = {};

function loadUsers(callback) {
    FS.readFile(CONFIG.path + '.pmg_perms', 'utf8', function (err, data) {
        if (err) {
            return (typeof callback === 'function' && callback("Error while loading .pmg_perms: " + err));
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
                users = perms;
                return (typeof callback === 'function' && callback(false));
            } catch (err) {
                return (typeof callback === 'function' && callback("Error while parsing .pmg_perms: " + err));
            }
        }
    });
}

function loadPasswords(callback) {
    FS.readFile(CONFIG.path + '.pmg_passwords', 'utf8', function (err, data) {
        if (err) {
            return (typeof callback === 'function' && callback("Error while loading .pmg_passwords: " + err));
        } else {
            try {
                var perms = {};
                var lines = data.split("\r\n");
                var indexes = [];
                lines.some(function (line) {
                    if (line.match(/^#/)) { // Ignorujeme komentare
                    } else if (line.trim() === '') { // zrušit indexy
                        indexes = [];
                    } else if (!line.match(/^ /)) { // řádek nezačíná mezerou, je to tedy heslo
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
                passwords = perms;
                return (typeof callback === 'function' && callback(false));
            } catch (err) {
                return (typeof callback === 'function' && callback("Error while parsing .pmg_passwords: " + err));
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

exports.getUser = function (username) {
    var perms = users[username];
    return ((perms) ? perms : []);
}
exports.getPass = function (password) {
    var perms = passwords[password];
    return ((perms) ? perms : []);
}


function reload(callback) {
    LOG.log("(Permissions) Loading permissions (users and passwords)");
    loadUsers(function (errorPerms) {
        loadPasswords(function (errorPass) {
            if (!errorPerms && !errorPass) {
                LOG.log('(Permissions) Passwords (' + Object.keys(passwords).length + ') and users (' + Object.keys(users).length + ') permissions were loaded.');
                LOG.debug('(Permissions) Passwords: ' + JSON.stringify(passwords), {console: false});
                LOG.debug('(Permissions) Users: ' + JSON.stringify(users), {console: false});
                return (typeof callback === 'function' && callback(false));
            }
            if (errorPass) {
                LOG.error('(Permissions) ' + errorPass);
                return (typeof callback === 'function' && callback(errorPass));
            }
            if (errorPerms) {
                LOG.error('(Permissions) ' + errorPerms);
                return (typeof callback === 'function' && callback(errorPerms));
            }
        });
    });
}
exports.reload = reload;
reload();
