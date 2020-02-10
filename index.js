require('./public/js/functions.js');
const c = require('./libs/config.js');
const LOG = require('./libs/log.js');
const FS = require("fs");
const perms = require('./libs/permissions.js');

LOG.info('***STARTING***');
perms.load();
// Start webserver(s)
require('./webserver/webserver.js');

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

