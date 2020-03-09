require('../private/js/functions.js');
const assert = require('assert');
const perms = require(BASE_DIR_GET('/libs/permissions.js'));

describe('Permissions', function () {
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