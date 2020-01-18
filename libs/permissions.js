const CONFIG = require('./config.js');
const FS = require("fs");
const LOG = require('./log.js');

let users = {};
let passwords = {};

function parsePermFile(filePath, callback) {
    FS.readFile(filePath, 'utf8', function (error, data) {
        if (error) {
            return (typeof callback === 'function' && callback('Error while loading "' + filePath + '": ' + error));
        }
        try {
            let perms = {};
            let lines = data.split("\r\n");
            let indexes = [];
            lines.some(function (line) {
                if (line.match(/^#/)) { // Ignore comments
                } else if (line.trim() === '') { // lane is empty, reset indexes
                    indexes = [];
                } else if (!line.match(/^ /)) { // line dont start with space so it is index
                    indexes.push(line);
                    if (perms[line] === undefined) {
                        perms[line] = [];
                    }
                } else { // line is some permission, save it to all currently loaded indexes
                    indexes.some(function (index) {
                        perms[index].push(line.trim());
                    });
                }
            });
            return (typeof callback === 'function' && callback(false, perms));
        } catch (error) {
            return (typeof callback === 'function' && callback('Error while parsing "' + filePath + '": ' + error));
        }
    });
}

function loadUsers(callback) {
    parsePermFile(CONFIG.path + '.pmg_perms', function(error, perms) {
        users = perms;
        callback(error);
    });
}
function loadPasswords(callback) {
    parsePermFile(CONFIG.path + '.pmg_passwords', function(error, perms) {
        passwords = perms;
        callback(error);
    });
}

exports.test = permissionCheck;
function permissionCheck(perms, path) {
    let result = false;
    perms.some(function (perm) {
        if ((path).indexOf(perm) === 0
            ||
            (perm.indexOf(path)) === 0
        ) {
            return result = true;
        }
    });
    return result;
}

exports.getUser = getUser;
function getUser(username) {
    let perms = users[username];
    return ((perms) ? perms : []);
}
exports.getPass = getPass;
function getPass(password) {
    let perms = passwords[password];
    return ((perms) ? perms : []);
}

exports.load = load;
function load(callback) {
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
