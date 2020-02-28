require('./private/js/functions.js');
const pathCustom = require('./libs/path.js');
pathCustom.defineBaseDir(require.main.filename);

const c = require(BASE_DIR_GET('/libs/config.js'));

const LOG = require(BASE_DIR_GET('/libs/log.js')).setPath(BASE_DIR_GET('/log/'));

const FS = require("fs");
const perms = require(BASE_DIR_GET('/libs/permissions.js'));
perms.load();

LOG.info('***STARTING***');
// Start webserver(s)
require(BASE_DIR_GET('/webserver/webserver.js'));

// Check if config.path is set correctly
try {
	let folderStats = FS.statSync(c.path);
	if (folderStats.isDirectory() === false) {
		throw new Error('it is not directory');
	}
	let items = FS.readdirSync(c.path);
	if (items.length === 0) {
		throw new Error('no items in base folder');
	}
	LOG.info('(Start) Defined base path "' + c.path + '" is valid with ' + items.length + ' items.');
} catch (error) {
	LOG.fatal('(Start) Defined base path "' + c.path + '" is invalid. Error: ' + error.message);
}

