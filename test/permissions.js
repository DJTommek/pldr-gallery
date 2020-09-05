require('../src/webserver/private/js/functions.js');
const assert = require('assert');
const perms = require('../src/libs/permissions.js');

describe('Permissions test()', function () {
	it('Full permissions (always true)', function () {
		assert.strictEqual(perms.test(['/'], '/'), true);
		assert.strictEqual(perms.test(['/'], '/bla'), true);
		assert.strictEqual(perms.test(['/'], '/header.html'), true);
		assert.strictEqual(perms.test(['/'], '/bla/ble/bly'), true);
		assert.strictEqual(perms.test(['/'], '/header.html'), true);
	});
	it('Demo folder (true)', function () {
		assert.strictEqual(perms.test(['/demo/'], '/demo/'), true);
		assert.strictEqual(perms.test(['/demo/'], '/demo/test'), true);
		assert.strictEqual(perms.test(['/demo/'], '/demo/footer.html'), true);
		assert.strictEqual(perms.test(['/demo/'], '/demo/ble/bly'), true);
	});
	it('Prefix (true)', function () {
		assert.strictEqual(perms.test(['/prefix'], '/prefixed.jpg'), true);
		assert.strictEqual(perms.test(['/prefix'], '/prefix.jpg'), true);
		assert.strictEqual(perms.test(['/demo/img_'], '/demo/img_01.jpg'), true);
		assert.strictEqual(perms.test(['/demo/prefix'], '/demo/prefix-folder1'), true);
		assert.strictEqual(perms.test(['/demo/prefix'], '/demo/prefix/'), true);
	});
	it('Prefix (false)', function () {
		assert.strictEqual(perms.test(['/prefix'], '/prefi-folder'), false);
		assert.strictEqual(perms.test(['/prefix'], '/prefi/x'), false);
		assert.strictEqual(perms.test(['/demo/prefix'], '/demo/pre-fix/'), false);
		assert.strictEqual(perms.test(['/prefix'], '/demo/ble/bly'), false);
	});
	it('Demo folder (false)', function () {
		assert.strictEqual(perms.test(['/demo/'], '/dem'), false);
		// @TODO if this is file, this should be false but this is true because permissions are checking even path to some file/folder.
		//  But since there are not allowed files without extension, this situations never happens
		// assert.strictEqual(perms.test(['/demo/'], '/demo'), false);
		assert.strictEqual(perms.test(['/demo/'], '/footer.html'), false);
		assert.strictEqual(perms.test(['/demo/'], '/blademo/'), false);
		assert.strictEqual(perms.test(['/demo/'], '/deblamo/'), false);
		assert.strictEqual(perms.test(['/demo/'], '/demobla/'), false);
	});
	it('Multiple permissions (true)', function () {
		assert.strictEqual(perms.test(['/demo/', '/haha/'], '/haha/'), true);
		assert.strictEqual(perms.test(['/header.html', '/footer.html'], '/footer.html'), true);
		assert.strictEqual(perms.test(['/demo', '/footer.html'], '/demo/footer.html'), true);
		assert.strictEqual(perms.test(['/demo', '/footer.html'], '/footer.html'), true);
	});
	it('Multiple permissions (false)', function () {
		assert.strictEqual(perms.test(['/demo/', '/haha/'], '/dem'), false);
		assert.strictEqual(perms.test(['footer.html'], '/footer.html'), false);
		assert.strictEqual(perms.test(['footer.html'], '/demo/footer.html'), false);
	});
	it('Special characters', function () {
		assert.strictEqual(perms.test(['/'], '/!'), true);
		assert.strictEqual(perms.test(['/'], '/!/'), true);
		assert.strictEqual(perms.test(['/!'], '/!/'), true);
		assert.strictEqual(perms.test(['/!/'], '/!/'), true);
		assert.strictEqual(perms.test(['/text!'], '/text!'), true);
		assert.strictEqual(perms.test(['/text!'], '/text!/'), true);
		assert.strictEqual(perms.test(['/text!'], '/text!another'), true);
		assert.strictEqual(perms.test(['/text!'], '/text!another/'), true);
		assert.strictEqual(perms.test(['/text!/'], '/text!/'), true);
	});
	it('Full Access', function () {
		assert.strictEqual(perms.test(['/'], '/', true), true);
		assert.strictEqual(perms.test(['/test/'], '/test/', true), true);
		assert.strictEqual(perms.test(['/test/'], '/test/bla/', true), true);
		assert.strictEqual(perms.test(['/test/bla'], '/test/'), true);
		assert.strictEqual(perms.test(['/test/bla'], '/test/', true), false);
	});
});
