require('../src/webserver/private/js/functions.js');
const c = require('../src/libs/config.js');
const assert = require('assert');
const perms = require('../src/libs/permissions.js');
const knex = require('knex')(c.knex);
const FS = require("fs");

describe('Permissions test()', function () {
	it('Full permissions (always true)', function () {
		assert.equal(perms.test(['/'], '/'), true);
		assert.equal(perms.test(['/'], '/bla'), true);
		assert.equal(perms.test(['/'], '/header.html'), true);
		assert.equal(perms.test(['/'], '/bla/ble/bly'), true);
		assert.equal(perms.test(['/'], '/header.html'), true);
	});
	it('Demo folder (true)', function () {
		assert.equal(perms.test(['/demo/'], '/demo/'), true);
		assert.equal(perms.test(['/demo/'], '/demo/test'), true);
		assert.equal(perms.test(['/demo/'], '/demo/footer.html'), true);
		assert.equal(perms.test(['/demo/'], '/demo/ble/bly'), true);
	});
	it('Prefix (true)', function () {
		assert.equal(perms.test(['/prefix'], '/prefixed.jpg'), true);
		assert.equal(perms.test(['/prefix'], '/prefix.jpg'), true);
		assert.equal(perms.test(['/demo/img_'], '/demo/img_01.jpg'), true);
		assert.equal(perms.test(['/demo/prefix'], '/demo/prefix-folder1'), true);
		assert.equal(perms.test(['/demo/prefix'], '/demo/prefix/'), true);
	});
	it('Prefix (false)', function () {
		assert.equal(perms.test(['/prefix'], '/prefi-folder'), false);
		assert.equal(perms.test(['/prefix'], '/prefi/x'), false);
		assert.equal(perms.test(['/demo/prefix'], '/demo/pre-fix/'), false);
		assert.equal(perms.test(['/prefix'], '/demo/ble/bly'), false);
	});
	it('Demo folder (false)', function () {
		assert.equal(perms.test(['/demo/'], '/dem'), false);
		// @TODO if this is file, this should be false but this is true because permissions are checking even path to some file/folder.
		//  But since there are not allowed files without extension, this situations never happens
		// assert.equal(perms.test(['/demo/'], '/demo'), false);
		assert.equal(perms.test(['/demo/'], '/footer.html'), false);
		assert.equal(perms.test(['/demo/'], '/blademo/'), false);
		assert.equal(perms.test(['/demo/'], '/deblamo/'), false);
		assert.equal(perms.test(['/demo/'], '/demobla/'), false);
	});
	it('Multiple permissions (true)', function () {
		assert.equal(perms.test(['/demo/', '/haha/'], '/haha/'), true);
		assert.equal(perms.test(['/header.html', '/footer.html'], '/footer.html'), true);
		assert.equal(perms.test(['/demo', '/footer.html'], '/demo/footer.html'), true);
		assert.equal(perms.test(['/demo', '/footer.html'], '/footer.html'), true);
	});
	it('Multiple permissions (false)', function () {
		assert.equal(perms.test(['/demo/', '/haha/'], '/dem'), false);
		assert.equal(perms.test(['footer.html'], '/footer.html'), false);
		assert.equal(perms.test(['footer.html'], '/demo/footer.html'), false);
	});
	it('Special characters', function () {
		assert.equal(perms.test(['/'], '/!'), true);
		assert.equal(perms.test(['/'], '/!/'), true);
		assert.equal(perms.test(['/!'], '/!/'), true);
		assert.equal(perms.test(['/!/'], '/!/'), true);
		assert.equal(perms.test(['/text!'], '/text!'), true);
		assert.equal(perms.test(['/text!'], '/text!/'), true);
		assert.equal(perms.test(['/text!'], '/text!another'), true);
		assert.equal(perms.test(['/text!'], '/text!another/'), true);
		assert.equal(perms.test(['/text!/'], '/text!/'), true);
	});
	it('Full Access', function () {
		assert.equal(perms.test(['/'], '/', true), true);
		assert.equal(perms.test(['/test/'], '/test/', true), true);
		assert.equal(perms.test(['/test/'], '/test/bla/', true), true);
		assert.equal(perms.test(['/test/bla'], '/test/'), true);
		assert.equal(perms.test(['/test/bla'], '/test/', true), false);
	});
});

describe('Permissions sqlite database',  async function () {
	// Create testing database
	try {
		FS.unlinkSync(c.knex.connection.filename);
	} catch (error) {
		console.error('Error: cant delete database file');
	}
	await knex.schema.createTable('user', function (table) {
		table.increments('id');
		table.string('email');
	}).createTable('group', function (table) {
		table.increments('id');
		table.string('name');
	}).createTable('user_group', function (table) {
		table
			.integer('user_id')
			.unsigned()
			.notNullable()
			.references('user.id');
		table
			.integer('group_id')
			.unsigned()
			.notNullable()
			.references('group.id');
	}).createTable('permission', function (table) {
		table.increments('id');
		table
			.integer('user_id')
			.unsigned()
			.references('user.id');
		table
			.integer('group_id')
			.unsigned()
			.references('group.id');
		table
			.string('permission')
	}).then(function () {
		knex.batchInsert('user', [
			{id: 1, email: 'foo@bar.com'},
			{id: 2, email: 'foo2@bar.com'},
			{id: 3, email: 'foo3@bar.com'},
			{id: 4, email: 'admin@mail.com'},
		]).catch(function (error) {
			console.error('Error #1: ' + error.message);
		});
		knex.batchInsert('group', [
			{id: perms.GROUPS.ALL, name: 'all'},
			{id: perms.GROUPS.NON_LOGGED, name: 'non-logged'},
			{id: perms.GROUPS.LOGGED, name: 'logged'},
			{id: 4, name: 'group-a'},
		]).catch(function (error) {
			console.error('Error #2: ' + error.message);
		});
	}).then(function () {
		console.log("some random insert");
		knex.batchInsert('user_group', [
			{user_id: 2, group_id: 4},
			{user_id: 3, group_id: 4},
		]).catch(function (error) {
			console.error('Error #3: ' + error.message);
		});
		knex.batchInsert('permission', [
			// users
			{user_id: 1, permission: '/permissions/4 - visible for user1/'},
			{user_id: 4, permission: '/'},
			// group:
			{group_id: 4, permission: '/permissions/secured-folder/'},
			// group: non-logged
			{group_id: 1, permission: '/permissions/header.html'},
			{group_id: 1, permission: '/empty folder/'},
			{group_id: 1, permission: '/files/'},
			{group_id: 1, permission: '/header and footer/'},
			{group_id: 1, permission: '/map from EXIF/'},
			{group_id: 1, permission: '/permissions/header.html'},
			{group_id: 1, permission: '/sort-test/'},
			{group_id: 1, permission: '/special-characters/'},
			{group_id: 1, permission: '/thumbnails/'},
			{group_id: 1, permission: '/header.html'},
			{group_id: 1, permission: '/footer.html'}
		]).catch(function (error) {
			console.error('Error #4: ' + error.message);
		});
	}).catch(function (error) {
		console.error('Error #5: ' + error.message);
	});

	console.log('all is done');

	it('Full permissions (always true)', async function () {
		assert.equal('a', 'b');
		console.log('it testing');
	});
});
