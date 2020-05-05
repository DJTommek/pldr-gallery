const CONFIG = require('./config.js');
const FS = require("fs");
const LOG = require('./log.js');
const pathCustom = require('./path.js');
const knex = require('knex')(CONFIG.db.knex);

let users = {};
let users2 = {
	x: [],
};
let passwords = {};

module.exports.GROUPS = {
	ALL: 1,
	NON_LOGGED: 2,
	LOGGED: 3,
}

module.exports.getAllUsers = function () {
	return users;
}
module.exports.getAllPasswords = function () {
	return passwords;
}

function parsePermFile(filePath, callback) {
	FS.readFile(filePath, 'utf8', function (error, data) {
		if (error) {
			return (typeof callback === 'function' && callback('Error while loading "' + filePath + '": ' + error));
		}
		try {
			let perms = {};
			let lines = data.split("\n");
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
	parsePermFile(CONFIG.path + '.pmg_perms', function (error, perms) {
		users = perms;
		callback(error);
	});
}

async function loadUsersDb(callback) {
	// select all
	(await knex(CONFIG.db.table.permission)
			.select('group_id', {bla: knex.raw('GROUP_CONCAT(permission)')})
			// .where({group_id: module.exports.GROUPS.ALL})
			.whereNotNull('group_id')
			.whereNull('user_id')
			.groupBy('group_id')
	).forEach(function (data) {
		console.log(data)
		// users2.x.push(data.permission)
	});
	console.log(users2)
	// @TODO select non-logged
	// @TODO select logged
	// Select permissions for users
	// (await knex(CONFIG.db.table.permission).select('user_id', 'GROUP_CONCAT(permission)').where({group_id: module.exports.GROUPS.ALL})).forEach(function(data) {
	// 	users2.x.push(data.permission)
	// });
	/*
	SELECT user_id, GROUP_CONCAT(permission)
	FROM permission
	WHERE group_id = 1
	GROUP BY user_id

	 */
}

function loadPasswords(callback) {
	parsePermFile(CONFIG.path + '.pmg_passwords', function (error, perms) {
		passwords = perms;
		callback(error);
	});
}

exports.test = permissionCheck;

/**
 * Check if given path is approvedd according given permissions
 *
 * @param {[string]} permissions
 * @param {string} path
 * @param {boolean} fullAccess set true to check, if user has to have full permission to given folder (not only some files/folders inside that path)
 * @returns {boolean}
 */
function permissionCheck(permissions, path, fullAccess = false) {
	let result = false;
	permissions.some(function (permission) {
		if (path.indexOf(permission) === 0) {
			// requested path is fully in perms
			result = true;
		}
		if (fullAccess === false && permission.indexOf(pathCustom.join(path + '/')) === 0) {
			// show folder, which lead to files saved deeper
			result = true;
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
	loadUsersDb()
}
