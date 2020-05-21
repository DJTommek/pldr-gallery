require('../webserver/private/js/functions.js');
const pathCustom = require('../libs/path.js');
pathCustom.defineBaseDir(__dirname + '/../../..');
console.log(BASE_DIR)

const c = require('../libs/config.js');
const knex = require('knex')(c.db.knex)

const LOG = require('../libs/log.js').setup({
	path: __dirname + '/../../data/log/',
	catchGlobalExceptions: true,
});

const perms = require('../libs/permissions.js');

// Check if config.path is set correctly

module.exports.run = async function run(purgeFirst = false, insertDemoData = true) {
	LOG.info('(Knex) Starting creating demo db...');
	if (purgeFirst === true) {
		await purgeData();
	}
	LOG.info('(Knex) Creating table "' + c.db.table.user + '"...');
	await knex.schema.createTable(c.db.table.user, function (table) {
		table.increments('id');
		table.string('email');
	});
	LOG.info('(Knex) Created table "' + c.db.table.user + '".');
	LOG.info('(Knex) Creating table "' + c.db.table.group + '"...');
	await knex.schema.createTable(c.db.table.group, function (table) {
		table.increments('id');
		table.string('name');
	})
	LOG.info('(Knex) Created table "' + c.db.table.group + '".');
	LOG.info('(Knex) Creating table "' + c.db.table.password + '"...');
	await knex.schema.createTable(c.db.table.password, function (table) {
		table.increments('id');
		table.string('password');
	})
	LOG.info('(Knex) Created table "' + c.db.table.password + '".');
	LOG.info('(Knex) Creating table "' + c.db.table.user_group + '"...');
	await knex.schema.createTable(c.db.table.user_group, function (table) {
		table
			.integer('user_id')
			.unsigned()
			.notNullable()
			.references(c.db.table.user + '.id');
		table
			.integer('group_id')
			.unsigned()
			.notNullable()
			.references(c.db.table.group + '.id');
	})
	LOG.info('(Knex) Created table "' + c.db.table.user_group + '".');
	LOG.info('(Knex) Creating table "' + c.db.table.permission + '"...');
	await knex.schema.createTable(c.db.table.permission, function (table) {
		table.increments('id');
		table
			.integer('user_id')
			.unsigned()
			.references(c.db.table.user + '.id');
		table
			.integer('group_id')
			.unsigned()
			.references(c.db.table.group + '.id');
		table
			.integer('password_id')
			.unsigned()
			.references(c.db.table.password + '.id');
		table
			.string('permission')
	})
	LOG.info('(Knex) Created table "' + c.db.table.permission + '".');
	if (insertDemoData === true) {
		await fillDemoData();
	}
}

async function purgeData() {
	LOG.info('(Knex) Purging data requested...');
	try {
		await knex.schema
			.dropTableIfExists(c.db.table.permission)
			.dropTableIfExists(c.db.table.password)
			.dropTableIfExists(c.db.table.user_group)
			.dropTableIfExists(c.db.table.user)
			.dropTableIfExists(c.db.table.group)
			LOG.info('(Knex) Data purged');
	} catch(error) {
		LOG.error('(Knex) Error while removing tables: ' + error.message);
		throw error;
	}
}

async function fillDemoData() {
	LOG.info('(Knex) Filling db with demo data...');
	LOG.info('(Knex) DB filling with demo users...');
	await knex.batchInsert(c.db.table.user, [
		{id: 1, email: 'foo@bar.com'},
		{id: 2, email: 'foo2@bar.com'},
		{id: 3, email: 'foo3@bar.com'},
		{id: 4, email: 'admin@mail.com'},
	]);
	LOG.info('(Knex) DB filled with demo users');
	LOG.info('(Knex) DB filling with demo groups...');
	await knex.batchInsert(c.db.table.group, [
		{id: perms.GROUPS.ALL, name: 'all'},
		{id: perms.GROUPS.NON_LOGGED, name: 'non-logged'},
		{id: perms.GROUPS.LOGGED, name: 'logged'},
		{id: 4, name: 'group-a'},
	]);
	LOG.info('(Knex) DB filled with demo groups');
	LOG.info('(Knex) DB filling with user-group relations...');
	await knex.batchInsert(c.db.table.user_group, [
		{user_id: 2, group_id: 4},
		{user_id: 3, group_id: 4},
	]);
	LOG.info('(Knex) DB filled with user-group relations');
	LOG.info('(Knex) DB filling with password...');
	await knex.batchInsert(c.db.table.password, [
		{id: 1, password: 'password1'},
		{id: 2, password: 'some password'},
		{id: 3, password: 'permissions-show-footer'},
		{id: 4, password: 'more permissions!'},
		{id: 5, password: 'secured images'},
		{id: 6, password: 'access-to-everything'},
	]);
	LOG.info('(Knex) DB filled with passwords');
	LOG.info('(Knex) DB filling with permissions...');
	await knex.batchInsert(c.db.table.permission, [
		// users
		{user_id: 1, permission: '/permissions/4 - visible for user1/'},
		{user_id: 1, permission: '/permissions/4 - another visible for user1/'},
		{user_id: 4, permission: '/'},
		// group
		{group_id: 4, permission: '/permissions/secured-folder/'},
		// group: non-logged
		{group_id: perms.GROUPS.ALL, permission: '/permissions/header.html'},
		{group_id: perms.GROUPS.ALL, permission: '/empty folder/'},
		{group_id: perms.GROUPS.ALL, permission: '/files/'},
		{group_id: perms.GROUPS.ALL, permission: '/header and footer/'},
		{group_id: perms.GROUPS.ALL, permission: '/map from EXIF/'},
		{group_id: perms.GROUPS.ALL, permission: '/permissions/header.html'},
		{group_id: perms.GROUPS.ALL, permission: '/sort-test/'},
		{group_id: perms.GROUPS.ALL, permission: '/special-characters/'},
		{group_id: perms.GROUPS.ALL, permission: '/thumbnails/'},
		{group_id: perms.GROUPS.ALL, permission: '/header.html'},
		{group_id: perms.GROUPS.ALL, permission: '/footer.html'},
		{group_id: perms.GROUPS.ALL, permission: '/image-'},
		// passwords
		{password_id: 1, permission: '/permissions/secured-folder/'},
		{password_id: 1, permission: '/folder2/'},
		{password_id: 1, permission: '/prefix-'},

		{password_id: 2, permission: '/foo1/'},
		{password_id: 2, permission: '/bar2/'},

		{password_id: 3, permission: '/permissions/footer.html'},

		{password_id: 4, permission: '/permissions/secured-folder/'},
		{password_id: 4, permission: '/permissions/secured-folder-with-header/header.html'},

		{password_id: 5, permission: '/permissions/secured-image'},

		{password_id: 6, permission: '/permissions/'},
	]);
	LOG.info('(Knex) DB filled with permissions');
	process.exit();
}

this.run(true, true);
