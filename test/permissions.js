require('../public/js/functions.js');
const assert = require('assert');
const perms = require('../libs/permissions.js');

describe('Permissions', function() {
  it('Full permissions, should be always true', function() {
    assert.equal(perms.test(['/'], '/'), true);
    assert.equal(perms.test(['/'], '/bla'), true);
    assert.equal(perms.test(['/'], '/header.html'), true);
    assert.equal(perms.test(['/'], '/bla/ble/bly'), true);
  });
  it('Demo permissions (true)', function() {
    assert.equal(perms.test(['/demo/'], '/demo/'), true);
    assert.equal(perms.test(['/demo/'], '/demo/test'), true);
    assert.equal(perms.test(['/demo/'], '/demo/footer.html'), true);
    assert.equal(perms.test(['/demo/'], '/demo/ble/bly'), true);
  });
  it('Demo permissions (false)', function() {
    assert.equal(perms.test(['/demo/'], '/dem'), false);
    assert.equal(perms.test(['/demo/'], '/dem/'), false);
    assert.equal(perms.test(['/demo/'], '/footer.html'), false);
    assert.equal(perms.test(['/demo/'], '/blademo/'), false);
    assert.equal(perms.test(['/demo/'], '/deblamo/'), false);
    assert.equal(perms.test(['/demo/'], '/demobla/'), false);
  });
  it('Multiple permissions (true)', function() {
    assert.equal(perms.test(['/demo/', '/haha/'], '/dem'), false);
    assert.equal(perms.test(['footer.html'], '/footer.html'), false);
  });
});