const CONFIG = require('./config.js');
const LOG = require('./log.js');
const pathCustom = require('./path.js');
const PATH = require('path');
const knex = require('./database.js');
const HFS = require('./helperFileSystem');
require(BASE_DIR_GET('/src/webserver/private/js/class/Icon.js'));
require(BASE_DIR_GET('/src/webserver/private/js/class/FileExtensionMapper.js'));
const utils = require("./utils/utils");
const FS = require('fs');
const Permission = require('./Permission.js');

module.exports.GROUPS = {
	ALL: 1,
	NON_LOGGED: 2,
	LOGGED: 3,
}

let USERS = {};
let PASSWORDS = {};
let GROUPS = {}

module.exports.getAllUsers = function () {
	return USERS;
}
module.exports.getAllPasswords = function () {
	return PASSWORDS;
}
module.exports.getAllGroups = function () {
	return GROUPS;
}

/**
 * Check if permission is valid and file or folder exists.
 *
 * @param {string} permission
 */
function validatePermission(permission) {
	if (permission.startsWith('/') === false) {
		throw new Error('Permission path must start with foward slash.');
	}

	if (permission.endsWith('/')) {
		// directory
	} else if (permission.match(FileExtensionMapperInstance.regexAll)) {
		// file
	} else if (PATH.basename(permission) === 'header.html') {
		// header
	} else if (PATH.basename(permission) === 'footer.html') {
		// footer
	} else {
		throw new Error('Invalid permission format or unsupported file extension.');
	}

	const fullPath = pathCustom.relativeToAbsolute(permission, CONFIG.path);
	const fileStats = FS.lstatSync(fullPath); // throws exception if not exists or not accessible

	if (fullPath.endsWith('/')) { // It should be directory
		if (fileStats.isDirectory()) {
			return;
		}
		throw new Error('Not directory.');
	}

	if (fileStats.isFile() === false) {
		throw new Error('Not file.');
	}
}

async function loadGroupsDb() {
	(await knex(CONFIG.db.table.group)
			.select(
				CONFIG.db.table.group + '.id',
				CONFIG.db.table.group + '.name',
				CONFIG.db.table.permission + '.permission',
				CONFIG.db.table.permission + '.can_write',
			)
			.leftJoin(CONFIG.db.table.permission, CONFIG.db.table.permission + '.group_id', CONFIG.db.table.group + '.id')
			.groupBy(CONFIG.db.table.group + '.id')
			.groupBy(CONFIG.db.table.permission + '.permission')
			.orderBy(CONFIG.db.table.group + '.id')
	).forEach(function (data) {
		if (GROUPS[data.id] === undefined) {
			GROUPS[data.id] = new Group(data.id, data['name']);
		}

		// if null, group exists but don't have any permissions assigned
		if (data.permission !== null) {
			try {
				validatePermission(data.permission);
			} catch (error) {
				LOG.warning('Group ID ' + data.id + ' has invalid permission "' + data.permission + '": "' + error.message + '"');
				return;
			}
		}
		if (data.permission !== null) {
			const permission = new Permission(data.permission, dbValueToBoolean(data.can_write));
			GROUPS[data.id].addPermission(permission);
		}
	});

	checkAndFixDefaultGroups();
}

/**
 * Check if default groups are created and return warning
 */
function checkAndFixDefaultGroups() {
	checkAndFixDefaultGroup(module.exports.GROUPS.ALL, 'all')
	checkAndFixDefaultGroup(module.exports.GROUPS.NON_LOGGED, 'non-logged')
	checkAndFixDefaultGroup(module.exports.GROUPS.LOGGED, 'logged')
}

function checkAndFixDefaultGroup(groupId, groupName) {
	if (!(groupId in GROUPS)) {
		const sqlString = knex(CONFIG.db.table.user).insert({id: groupId, name: groupName}).toString();
		LOG.warning('Default group ID ' + groupId + ' (name = ' + groupName + ') is not created in database - application ' +
			'might misbehave, eg. by not showing all directories and files. ' +
			'This should be fixed, example: ' +
			'"' + sqlString + '"');
		GROUPS[groupId] = new Group(groupId, groupName);
	}
}

async function loadPasswordsDb() {
	(await knex(CONFIG.db.table.password)
			.select(
				CONFIG.db.table.password + '.id',
				CONFIG.db.table.password + '.password',
				CONFIG.db.table.permission + '.permission',
				CONFIG.db.table.permission + '.can_write',
			)
			.leftJoin(CONFIG.db.table.permission, CONFIG.db.table.permission + '.password_id', CONFIG.db.table.password + '.id')
			.groupBy(CONFIG.db.table.password + '.id')
			.groupBy(CONFIG.db.table.permission + '.permission')
			.orderBy(CONFIG.db.table.password + '.id')
	).forEach(function (data) {
		if (PASSWORDS[data.id] === undefined) {
			PASSWORDS[data.id] = new Password(data.id, data.password);
		}

		// if null, password exists but don't have any permissions assigned
		if (data.permission === null) {
			LOG.warning('Password ID ' + data.id + ' don\'t have any permissions.');
		} else {
			try {
				validatePermission(data.permission);
			} catch (error) {
				LOG.warning('Password ID ' + data.id + ' has invalid permission "' + data.permission + '": "' + error.message + '"');
				return;
			}
		}
		if (data.permission !== null) {
			const permission = new Permission(data.permission, dbValueToBoolean(data.can_write));
			PASSWORDS[data.id].addPermission(permission);
		}
	});
}

async function loadUsersDb() {
	(await knex(CONFIG.db.table.user)
			.select(
				CONFIG.db.table.user + '.id',
				CONFIG.db.table.user + '.email',
				CONFIG.db.table.permission + '.permission',
				CONFIG.db.table.permission + '.can_write',
			)
			.leftJoin(CONFIG.db.table.permission, CONFIG.db.table.permission + '.user_id', CONFIG.db.table.user + '.id')
			.groupBy(CONFIG.db.table.user + '.id')
			.groupBy(CONFIG.db.table.permission + '.permission')
			.orderBy(CONFIG.db.table.user + '.id')
	).forEach(function (data) {
		if (USERS[data.id] === undefined) {
			const user = new User(data.id, data['email']);
			// assign all users to generic groups
			user.addGroup(GROUPS[module.exports.GROUPS.ALL])
			user.addGroup(GROUPS[module.exports.GROUPS.LOGGED])
			USERS[data.id] = user;
		}

		// if null, group exists but don't have any permissions assigned
		if (data.permission !== null) {
			try {
				validatePermission(data.permission);
			} catch (error) {
				LOG.warning('User ID ' + data.id + ' has invalid permission "' + data.permission + '": "' + error.message + '"');
				return;
			}
		}

		if (data.permission !== null) {
			const permission = new Permission(data.permission, dbValueToBoolean(data.can_write));
			USERS[data.id].addPermission(permission);
		}
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
 * @param {array<Permission>} permissions
 * @param {string} path
 * @param {boolean} fullAccess set true to check, if user has to have full permission to given folder (not only some files/folders inside that path)
 * @param {boolean} requireWrite Returns true, only if matched permission has also canWrite
 * @returns {boolean}
 */
function permissionCheck(permissions, path, fullAccess = false, requireWrite = false) {
	const pathAsDir = pathCustom.join(path + '/');
	return permissions.some(function (permission) {
		if (path.startsWith(permission.path)) { // requested path is fully in perms
			return requireWrite === false || permission.canWrite;
		}

		if (fullAccess === false && permission.path.startsWith(pathAsDir)) { // show folder, which lead to files saved deeper
			return requireWrite === false || permission.canWrite;
		}
	});
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
	const nonLoggedUser = new User(0, null);
	nonLoggedUser.addGroup(GROUPS[module.exports.GROUPS.ALL])
	nonLoggedUser.addGroup(GROUPS[module.exports.GROUPS.NON_LOGGED])
	return nonLoggedUser;
}

/**
 * Generate new User and save it to database
 *
 * @param {string} email
 * @returns {User}
 */
exports.registerNewUser = async function registerNewUser(email) {
	// @TODO verify if string and valid email
	LOG.info('(Permissions) Registering new user with email "' + email + '"...');
	await knex(CONFIG.db.table.user).insert({email: email.toLowerCase()})
	await module.exports.load();
	return module.exports.getUser(email);
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
	clearCache();
	await loadPasswordsDb();
	await loadGroupsDb();
	await loadUsersDb();
	await loadUserGroupRelations();
	LOG.info('(Perms) Permissions were loaded and indexed: ' + Object.keys(USERS).length + ' users, ' + Object.keys(GROUPS).length + ' groups and ' + Object.keys(PASSWORDS).length + ' passwords.');
	if (callback && typeof callback !== 'function') {
		callback();
	}
}

function clearCache() {
	USERS = {};
	PASSWORDS = {};
	GROUPS = {};
}

class User {
	constructor(id, email) {
		this.id = id;
		this.email = email;
		/** @type {array<Permission>} */
		this.permissions = [];
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
	 * Remove passwords attached to this User to prevent duplicates
	 */
	clearPasswords() {
		this.passwords = [];
	}

	/**
	 * Check if user has permissions for given path
	 *
	 * @param {string} path
	 * @param {boolean} fullAccess @see permissionCheck()
	 * @param {boolean} requireWrite @see permissionCheck()
	 * @return {boolean}
	 */
	testPathPermission(path, fullAccess = false, requireWrite = false) {
		return permissionCheck(this.getPermissions(), path, fullAccess, requireWrite);
	}

	/**
	 * @param {Permission} permission
	 */
	addPermission(permission) {
		this.permissions.push(permission);
	}

	/**
	 * Get all permissions merged from user, groups and passwords
	 *
	 * @returns {array<Permission>}
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

	/**
	 * Generate avatar picture URL to Gravatar.com.
	 * If email is not filled, generate default user icon
	 *
	 * @returns {string}
	 */
	gravatarPicture() {
		const hash = this.email ? utils.md5(this.email) : '00000000000000000000000000000000';
		return 'https://www.gravatar.com/avatar/' + hash + '?d=robohash';
	}
}

class Group {
	constructor(id, name) {
		this.id = id;
		this.name = name;
		/** @type {array<Permission>} */
		this.permissions = [];
		this.users = [];
	}

	addUser(user) {
		if (user instanceof User) {
			this.users.push(user);
		} else {
			throw new Error('Invalid parameter "user": not instance of User');
		}
	}

	/**
	 * @param {Permission} permission
	 */
	addPermission(permission) {
		this.permissions.push(permission);
	}

	/**
	 * @return {array<Permission>}
	 */
	getPermissions() {
		return [...this.permissions];
	}
}

class Password {
	constructor(id, password) {
		this.id = id;
		this.password = password;
		/** @type {array<Permission>} */
		this.permissions = [];
	}

	/**
	 * @param {Permission} permission
	 */
	addPermission(permission) {
		this.permissions.push(permission);
	}

	/**
	 * @return {array<Permission>}
	 */
	getPermissions() {
		return [...this.permissions];
	}
}

/**
 * Different database systems can return different values, so convert usual boolean-like types into actual boolean.
 *
 * @param {boolean|number|string|null|undefined} input
 * @return {boolean}
 */
function dbValueToBoolean(input) {
	if (typeof input === 'boolean') {
		return input;
	}
	if (typeof input === 'number') {
		return input !== 0; // 0 = false, other values are true
	}

	if (input === undefined || input === null || input === '' || input === '0') {
		return false;
	}

	return true;
}
