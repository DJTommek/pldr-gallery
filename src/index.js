require('./webserver/private/js/functions.js');
const pathCustom = require('./libs/path.js');
pathCustom.defineBaseDir(require.main.filename);

const c = require('./libs/config.js');

const LOG = require('./libs/log.js').setup({
	path: __dirname + '/../data/log/',
	catchGlobalExceptions: true,
});

const FS = require("fs");
const perms = require('./libs/permissions.js');

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

LOG.info('***STARTING***');
perms.load();
// Start webserver(s)
require('./webserver/webserver.js');
