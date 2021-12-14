require('../webserver/private/js/functions.js');
const pathCustom = require('../libs/path.js');
pathCustom.defineBaseDir(__dirname + '/../../..');

const CONFIG = require('../libs/config.js');
const knex = require('knex')(CONFIG.db.knex);

const perms = require('../libs/permissions.js');

/**
 * Prepare demo database via Knex according config.
 *
 * @param {boolean} purge Remove tables
 * @param {boolean} insertDemoData Insert demo data
 * @return {void}
 */
module.exports.run = async function run(purge = false, insertDemoData = true) {
	console.log('(Knex) Starting creating demo database...');
	if ((await checkIfTablesExists()) === true) {
		console.log('(Knex) At least one table exists.');
		if (purge === true) {
			console.log('(Knex) Database purge is set to true, purging...');
			await purgeData();
			console.log('(Knex) Purge completed, continuing...');
		} else {
			console.log('(Knex) Database purge is set to false, quitting script.');
			return exit();
		}
	}
	await createTables();
	if (insertDemoData === true) {
		await fillDemoData();
	}
	return exit();
}

async function exit() {
	console.log('(Knex) Disconnecting from database...');
	await knex.destroy();
	console.log('(Knex) Disconnected from database.');
}

/**
 * Get list of tables
 *
 * @TODO currently sqlite3 only, add support at least for mysql
 * @author https://github.com/knex/knex/issues/360#issuecomment-68387974
 * @return {Promise<boolean>}
 */
async function checkIfTablesExists() {
	return await knex.schema.raw('SELECT name FROM sqlite_master WHERE type=\'table\';').then(function (tables) {
		const tableNames = [];
		tables.forEach(function (table) {
			tableNames.push(table.name);
		});

		let tablesExists = false;
		for (const configTable in CONFIG.db.table) {
			if (tableNames.inArray(CONFIG.db.table[configTable]) === true) {
				tablesExists = true;
			}
		}
		return tablesExists;
	});
}

async function createTables() {
	try {
		console.log('(Knex) Creating table "' + CONFIG.db.table.user + '"...');
		await knex.schema.createTable(CONFIG.db.table.user, function (table) {
			table.increments('id');
			table.string('email');
		});
		console.log('(Knex) Created table "' + CONFIG.db.table.user + '".');
	} catch (error) {
		console.error('(Knex) Error while creating table "' + CONFIG.db.table.user + '": ' + error);
	}
	try {
		console.log('(Knex) Creating table "' + CONFIG.db.table.group + '"...');
		await knex.schema.createTable(CONFIG.db.table.group, function (table) {
			table.increments('id');
			table.string('name');
		})
		console.log('(Knex) Created table "' + CONFIG.db.table.group + '".');
	} catch (error) {
		console.error('(Knex) Error while creating table "' + CONFIG.db.table.group + '": ' + error);
	}
	try {
		console.log('(Knex) Creating table "' + CONFIG.db.table.password + '"...');
		await knex.schema.createTable(CONFIG.db.table.password, function (table) {
			table.increments('id');
			table.string('password');
		})
		console.log('(Knex) Created table "' + CONFIG.db.table.password + '".');
	} catch (error) {
		console.error('(Knex) Error while creating table "' + CONFIG.db.table.password + '": ' + error);
	}
	try {
		console.log('(Knex) Creating table "' + CONFIG.db.table.user_group + '"...');
		await knex.schema.createTable(CONFIG.db.table.user_group, function (table) {
			table
				.integer('user_id')
				.unsigned()
				.notNullable()
				.references(CONFIG.db.table.user + '.id');
			table
				.integer('group_id')
				.unsigned()
				.notNullable()
				.references(CONFIG.db.table.group + '.id');
		})
		console.log('(Knex) Created table "' + CONFIG.db.table.user_group + '".');
	} catch (error) {
		console.error('(Knex) Error while creating table "' + CONFIG.db.table.user_group + '": ' + error);
	}
	try {
		console.log('(Knex) Creating table "' + CONFIG.db.table.permission + '"...');
		await knex.schema.createTable(CONFIG.db.table.permission, function (table) {
			table.increments('id');
			table
				.integer('user_id')
				.unsigned()
				.references(CONFIG.db.table.user + '.id');
			table
				.integer('group_id')
				.unsigned()
				.references(CONFIG.db.table.group + '.id');
			table
				.integer('password_id')
				.unsigned()
				.references(CONFIG.db.table.password + '.id');
			table
				.string('permission')
		})
		console.log('(Knex) Created table "' + CONFIG.db.table.permission + '".');
	} catch (error) {
		console.error('(Knex) Error while creating table "' + CONFIG.db.table.permission + '": ' + error);
	}
	try {
		console.log('(Knex) Creating table "' + CONFIG.db.table.structure + '"...');
		await knex.schema.createTable(CONFIG.db.table.structure, async function (table) {
			table.increments('id');
			table
				.string('path', 191) // 191 is max for servers with limit 765 characters (UTF-8 string is taking 4 characters instead of 1)
				.unique('path')
				.notNullable();
			table
				.integer('type', 1)
				.notNullable()
				.unsigned()
				.index();
			table
				.bigInteger('created')
				.unsigned();
			table
				.integer('size')
				.unsigned();
			table
				.float('coordinate_lat', 10, 6);
			table
				.float('coordinate_lon', 10, 6);
			table
				.bigInteger('scanned')
				.notNullable()
				.unsigned();
			console.log('(Knex) Created table "' + CONFIG.db.table.structure + '".');
			try {
				// Add column "level", which is generated - not supported in Knex library, so we have to update table manually
				const query = 'ALTER TABLE ' + CONFIG.db.table.structure + ' ADD COLUMN level int AS (LENGTH(TRIM(TRAILING \'/\' FROM path)) - LENGTH(REPLACE(TRIM(TRAILING \'/\' FROM path), \'/\', \'\'))) STORED, ADD INDEX level;'
				await knex.schema.raw(query).then(function (result) {
					console.log(result);
				});
				console.log('(Knex) Added column "level" to table "' + CONFIG.db.table.structure + '".');
			} catch (error) {
				console.error('(Knex) Error while adding column "level" to table "' + CONFIG.db.table.structure + '": ' + error);
			}
			try {
				// Add column "coordinates", which is generated - not supported in Knex library, so we have to update table manually
				const query = 'ALTER TABLE ' + CONFIG.db.table.structure + ' ADD COLUMN coordinates POINT GENERATED ALWAYS AS (POINT(coordinate_lon, coordinate_lat)) STORED;'
				await knex.schema.raw(query).then(function (result) {
					console.log(result);
				});
				console.log('(Knex) Added column "coordinates" to table "' + CONFIG.db.table.structure + '".');
			} catch (error) {
				console.error('(Knex) Error while adding column "coordinates" to table "' + CONFIG.db.table.structure + '": ' + error);
			}
		});
	} catch (error) {
		console.error('(Knex) Error while creating table "' + CONFIG.db.table.structure + '": ' + error);
	}
}

async function purgeData() {
	console.log('(Knex) Purging data requested...');
	try {
		await knex.schema
			.dropTableIfExists(CONFIG.db.table.permission)
			.dropTableIfExists(CONFIG.db.table.password)
			.dropTableIfExists(CONFIG.db.table.user_group)
			.dropTableIfExists(CONFIG.db.table.user)
			.dropTableIfExists(CONFIG.db.table.group)
		console.log('(Knex) Data purged');
	} catch (error) {
		console.error('(Knex) Error while removing tables: ' + error.message);
		throw error;
	}
}

async function fillDemoData() {
	console.log('(Knex) Filling db with demo data...');
	console.log('(Knex) DB filling with demo users...');
	await knex.batchInsert(CONFIG.db.table.user, [
		{id: 1, email: 'foo@bar.com'},
		{id: 2, email: 'foo2@bar.com'},
		{id: 3, email: 'foo3@bar.com'},
		{id: 4, email: 'admin@mail.com'},
	]);
	console.log('(Knex) DB filled with demo users');
	console.log('(Knex) DB filling with demo groups...');
	await knex.batchInsert(CONFIG.db.table.group, [
		{id: perms.GROUPS.ALL, name: 'all'},
		{id: perms.GROUPS.NON_LOGGED, name: 'non-logged'},
		{id: perms.GROUPS.LOGGED, name: 'logged'},
		{id: 4, name: 'group-a'},
	]);
	console.log('(Knex) DB filled with demo groups');
	console.log('(Knex) DB filling with user-group relations...');
	await knex.batchInsert(CONFIG.db.table.user_group, [
		{user_id: 2, group_id: 4},
		{user_id: 3, group_id: 4},
	]);
	console.log('(Knex) DB filled with user-group relations');
	console.log('(Knex) DB filling with password...');
	await knex.batchInsert(CONFIG.db.table.password, [
		{id: 1, password: 'passwords-show-footer'},
		{id: 2, password: 'password more permissions!'},
		{id: 3, password: 'passwords secured images'},
		{id: 4, password: 'passwords-for-everything'},
	]);
	console.log('(Knex) DB filled with passwords');
	console.log('(Knex) DB filling with permissions...');
	await knex.batchInsert(CONFIG.db.table.permission, [
		// users
		{user_id: 1, permission: '/permissions/user 1 a/'},
		{user_id: 1, permission: '/permissions/user 1 b/'},
		{user_id: 4, permission: '/permissions/'},

		// groups
		{group_id: perms.GROUPS.ALL, permission: '/permissions/header.html'},
		{group_id: perms.GROUPS.ALL, permission: '/empty folder/'},
		{group_id: perms.GROUPS.ALL, permission: '/files/'},
		{group_id: perms.GROUPS.ALL, permission: '/header and footer/'},
		{group_id: perms.GROUPS.ALL, permission: '/map from EXIF/'},
		{group_id: perms.GROUPS.ALL, permission: '/sort-test/'},
		{group_id: perms.GROUPS.ALL, permission: '/special-characters/'},
		{group_id: perms.GROUPS.ALL, permission: '/thumbnails/'},
		{group_id: perms.GROUPS.ALL, permission: '/header.html'},
		{group_id: perms.GROUPS.ALL, permission: '/footer.html'},
		{group_id: perms.GROUPS.ALL, permission: '/image-'},
		{group_id: perms.GROUPS.ALL, permission: '/passwords/header.html'},
		{group_id: perms.GROUPS.ALL, permission: '/permissions/header.html'},
		{group_id: perms.GROUPS.ALL, permission: '/permissions/all/'},

		{group_id: perms.GROUPS.NON_LOGGED, permission: '/permissions/only-non-logged/'},

		{group_id: perms.GROUPS.LOGGED, permission: '/permissions/only-logged/'},

		{group_id: 4, permission: '/permissions/group a/'},
		// passwords
		{password_id: 1, permission: '/passwords/footer.html'},

		{password_id: 2, permission: '/passwords/secured-folder/header.html'},

		{password_id: 3, permission: '/passwords/secured-image'},

		{password_id: 4, permission: '/passwords/'},
	]);
	console.log('(Knex) DB filled with permissions');
}
