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

let GROUPS = {
	[module.exports.GROUPS.ALL]: [],
	[module.exports.GROUPS.NON_LOGGED]: [],
	[module.exports.GROUPS.LOGGED]: [],
}

let USERS = {};
let PASSWORDS = {};

module.exports.getAllUsers = function () {
	return USERS;
}
module.exports.getAllPasswords = function () {
	return PASSWORDS;
}

module.exports.getAllGroups = function () {
	return GROUPS;
}

async function loadGroupsDb() {
	(await knex(CONFIG.db.table.group)
			.select(
				CONFIG.db.table.group + '.id',
				CONFIG.db.table.group + '.name',
				{permissions: knex.raw('GROUP_CONCAT(' + CONFIG.db.table.permission + '.permission SEPARATOR \';\')')}
			)
			.leftJoin(CONFIG.db.table.permission, CONFIG.db.table.permission + '.group_id', CONFIG.db.table.group + '.id')
			.groupBy(CONFIG.db.table.group + '.id')
	).forEach(function (data) {
		GROUPS[data['id']] = new Group(
			data['id'],
			data['name'],
			(data['permissions'] ? data['permissions'].split(';') : []),
		);
	});
}

async function loadUsersDb() {
	(await knex(CONFIG.db.table.user)
			.select(
				CONFIG.db.table.user + '.id',
				CONFIG.db.table.user + '.email',
				{permissions: knex.raw('GROUP_CONCAT(' + CONFIG.db.table.permission + '.permission SEPARATOR \';\')')}
			)
			.leftJoin(CONFIG.db.table.permission, CONFIG.db.table.permission + '.user_id', CONFIG.db.table.user + '.id')
			.groupBy(CONFIG.db.table.user + '.id')
	).forEach(function (data) {
		const user = new User(
			data['id'],
			data['email'],
			(data['permissions'] ? data['permissions'].split(';') : []),
		);
		// assign all users to generic groups
		user.addGroup(GROUPS[module.exports.GROUPS.ALL])
		user.addGroup(GROUPS[module.exports.GROUPS.LOGGED])
		USERS[data['id']] = user;
	});
}

async function loadUserGroupRelations() {
	// select all user-group relations
	(await knex(CONFIG.db.table.user_group).select('user_id', 'group_id')).forEach(function (data) {
		const user = USERS[data['user_id'] + ''];
		const group = GROUPS[data['group_id'] + ''];
		group.addUser(user);
		user.addGroup(group);
	});

	// create non-logged user and assign to generic groups
	USERS[0] = new User(0, null, []);
	USERS[0].addGroup(GROUPS[module.exports.GROUPS.ALL])
	USERS[0].addGroup(GROUPS[module.exports.GROUPS.NON_LOGGED])

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

function getUser(email) {
	for (const user_id in USERS) {
		const user = USERS[user_id];
		if (user.email === email) {
			return user;
		}
	}
	return null;
}

exports.getNonLoggedUser = getNonLoggedUser;

function getNonLoggedUser() {
	return USERS[0];
}

exports.getUnknownLoggedUser = getUnknownLoggedUser;

function getUnknownLoggedUser(email) {
	// generate new user without saving and return default instance
	const unknownLoggedUser = new User(null, email, []);
	unknownLoggedUser.addGroup(GROUPS[module.exports.GROUPS.ALL])
	unknownLoggedUser.addGroup(GROUPS[module.exports.GROUPS.NON_LOGGED])
	return unknownLoggedUser;
}

exports.getPass = getPass;

function getPass(password) {
	let perms = PASSWORDS[password];
	return ((perms) ? perms : []);
}

exports.load = load;

async function load(callback) {
	LOG.info('(Perms) Loading permissions...');
	await loadGroupsDb();
	await loadUsersDb();
	await loadUserGroupRelations();
	LOG.info('(Perms) Permissions were loaded and indexed: ' + Object.keys(USERS).length + ' users and ' + Object.keys(GROUPS).length + ' groups.');
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

	getPermissions() {
		let permissions = [...this.permissions];
		for (const group of this.groups) {
			permissions.push(...group.getPermissions());
		}
		return permissions;
	}
}

class Group {
	constructor(id, name, permissions) {
		this.id = id;
		this.name = name;
		this.permissions = permissions;
		this.users = [];
	}

	addUser(user) {
		this.users.push(user);
	}

	getPermissions() {
		return [...this.permissions];
	}
}