const CONFIG = require('./config.js');
const FS = require("fs");
const LOG = require('./log.js');
const pathCustom = require('./path.js');
const knex = require('./database.js');

module.exports.GROUPS = {
	ALL: 1,
	NON_LOGGED: 2,
	LOGGED: 3,
}

let groups = {
	[module.exports.GROUPS.ALL]: [],
	[module.exports.GROUPS.NON_LOGGED]: [],
	[module.exports.GROUPS.LOGGED]: [],
}

let users = {};
let passwords = {};

module.exports.getAllUsers = function () {
	return users;
}
module.exports.getAllPasswords = function () {
	return passwords;
}

async function loadUsersDb(callback) {
	(await knex(CONFIG.db.table.user)
			.select(
				CONFIG.db.table.user + '.id',
				CONFIG.db.table.user + '.email',
				{permissions: knex.raw('GROUP_CONCAT(' + CONFIG.db.table.permission + '.permission SEPARATOR \';\')')}
				)
			.leftJoin(CONFIG.db.table.permission, CONFIG.db.table.permission + '.user_id', CONFIG.db.table.user + '.id')
			.groupBy(CONFIG.db.table.user + '.id')
	).forEach(function (data) {
		console.log(typeof data['id']);
		users[data['id']] = new User(
			data['id'],
			data['email'],
			(data['permissions'] ? data['permissions'].split(';') : []),
		);
	});
}

async function loadGroupsDb(callback) {
	(await knex(CONFIG.db.table.group)
			.select(
				CONFIG.db.table.group + '.id',
				CONFIG.db.table.group + '.name',
				{permissions: knex.raw('GROUP_CONCAT(' + CONFIG.db.table.permission + '.permission SEPARATOR \';\')')}
				)
			.leftJoin(CONFIG.db.table.permission, CONFIG.db.table.permission + '.group_id', CONFIG.db.table.group + '.id')
			.groupBy(CONFIG.db.table.group + '.id')
	).forEach(function (data) {
		groups[data['id']] = new Group(
			data['id'],
			data['name'],
			(data['permissions'] ? data['permissions'].split(';') : []),
		);
	});
}

async function loadUserGroupDb(callback) {
	// select all
	(await knex(CONFIG.db.table.user_group)
			.select('user_id', 'group_id')
	).forEach(function (data) {
		const user = users[data['user_id'] + ''];
		const group = groups[data['group_id'] + ''];
		group.addUser(user);
		user.addGroup(group);
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

exports.loadNew = loadNew;

async function loadNew(callback) {
	LOG.info('(Perms) Loading permissions...');
	await loadGroupsDb();
	await loadUsersDb();
	await loadUserGroupDb();
	LOG.info('(Perms) Permissions were loaded and indexed: ' + Object.keys(users).length + ' users and ' + Object.keys(groups).length + ' groups.');
	return (typeof callback === 'function' && callback(false));
}

class User {
	constructor(id, email, permissions) {
		this.id = id;
		this.email = email;
		this.permissions = permissions;
		this.groups = [];
	}
	addGroup(group) {
		this.groups.push(group);
	}
}

class Group {
	constructor (id, name, permissions) {
		this.id = id;
		this.name = name;
		this.permissions = permissions;
		this.users = [];
	}
	addUser(user) {
		this.users.push(user);
	}
}