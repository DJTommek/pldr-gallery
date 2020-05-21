const CONFIG = require('./config.js');
const LOG = require('./log.js');
const pathCustom = require('./path.js');
const knex = require('./database.js');

module.exports.GROUPS = {
	ALL: 1,
	NON_LOGGED: 2,
	LOGGED: 3,
}

let USERS = {};
let PASSWORDS = {};
let GROUPS = {
	[module.exports.GROUPS.ALL]: [],
	[module.exports.GROUPS.NON_LOGGED]: [],
	[module.exports.GROUPS.LOGGED]: [],
}

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

async function loadPasswordsDb() {
	(await knex(CONFIG.db.table.password)
			.select(
				CONFIG.db.table.password + '.id',
				CONFIG.db.table.password + '.password',
				{permissions: knex.raw('GROUP_CONCAT(' + CONFIG.db.table.permission + '.permission SEPARATOR \';\')')}
			)
			.leftJoin(CONFIG.db.table.permission, CONFIG.db.table.permission + '.password_id', CONFIG.db.table.password + '.id')
			.groupBy(CONFIG.db.table.password + '.id')
	).forEach(function (data) {
		PASSWORDS[data['id']] = new Password(
			data['id'],
			data['password'],
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

/**
 * Search users saved in database
 *
 * @param {string} email
 * @returns {User|null}
 */
exports.getUser = function getUser(email) {
	// @TODO validate if email is string and valid email
	for (const user_id in USERS) {
		const user = USERS[user_id];
		if (user.email === email) {
			return user;
		}
	}
	return null;
}

/**
 * Generate new unlogged User without saving to database
 *
 * @returns {User}
 */
exports.getNonLoggedUser = function getNonLoggedUser() {
	const nonLoggedUser = new User(0, null, []);
	nonLoggedUser.addGroup(GROUPS[module.exports.GROUPS.ALL])
	nonLoggedUser.addGroup(GROUPS[module.exports.GROUPS.NON_LOGGED])
	return nonLoggedUser;
}

/**
 * Generate new User without saving to database
 *
 * @param {string} email
 * @returns {User}
 */
exports.getUnknownLoggedUser = function getUnknownLoggedUser(email) {
	// @TODO validate if email is string and valid email
	// generate new user without saving and return default instance
	const unknownLoggedUser = new User(null, email, []);
	unknownLoggedUser.addGroup(GROUPS[module.exports.GROUPS.ALL])
	unknownLoggedUser.addGroup(GROUPS[module.exports.GROUPS.LOGGED])
	return unknownLoggedUser;
}

/**
 * Get Password object by given password
 *
 * @param {string} password
 * @returns {Password|null}
 */
exports.getPassword = function getPassword(password) {
	for (const password_id in PASSWORDS) {
		const passwordObject = PASSWORDS[password_id];
		if (passwordObject.password === password) {
			return passwordObject;
		}
	}
	return null;
}

exports.load = async function load(callback) {
	LOG.info('(Perms) Loading permissions...');
	await loadPasswordsDb();
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
		this.passwords = [];
	}

	addGroup(group) {
		if (group instanceof Group) {
			this.groups.push(group);
		} else {
			throw new Error('Invalid parameter "group": not instance of Group');
		}
	}

	addPassword(password) {
		if (password instanceof Password) {
			this.passwords.push(password);
		} else {
			throw new Error('Invalid parameter "password": not instance of Password');
		}
	}

	/**
	 * Get all permissions merged from user, groups and passwords
	 *
	 * @returns {string[]}
	 */
	getPermissions() {
		let permissions = [...this.permissions];
		for (const group of this.groups) {
			permissions.push(...group.getPermissions());
		}
		for (const password of this.passwords) {
			permissions.push(...password.getPermissions());
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
		if (user instanceof User) {
			this.users.push(user);
		} else {
			throw new Error('Invalid parameter "user": not instance of User');
		}
	}

	getPermissions() {
		return [...this.permissions];
	}
}

class Password {
	constructor(id, password, permissions) {
		this.id = id;
		this.password = password;
		this.permissions = permissions;
	}

	getPermissions() {
		return [...this.permissions];
	}
}