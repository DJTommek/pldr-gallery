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
(async function () {
	await perms.loadNew();
	const webserver = require('./webserver/webserver.js');
}());
// Start webserver(s)

c.stop.events.forEach(function (signalCode) {
	process.on(signalCode, function () {
		LOG.head('Received "' + signalCode + '" signal, stopping everything');
		Promise.all([
			new Promise(function (resolve, reject) {
				if (webserver.httpServer) {
					LOG.info('(Stop) closing HTTP server...');
					webserver.httpServer.close(function () {
						LOG.info('(Stop) HTTP server closed.');
						return resolve();
					});
				} else {
					return resolve();
				}
				setTimeout(function () {
					reject('Closing HTTP server timeouted after ' + c.stop.timeout + 'ms.');
				}, c.stop.timeout);
			}),
			new Promise(function (resolve) {
				if (webserver.httpsServer) {
					LOG.info('(Stop) closing HTTPS server...');
					webserver.httpsServer.close(function () {
						LOG.info('(Stop) HTTPS server closed.');
					});
				} else {
					return resolve();
				}
				setTimeout(function () {
					reject('Closing HTTPS server timeouted after ' + c.stop.timeout + 'ms.');
				}, c.stop.timeout);
			}),
		]).then(function () {
			LOG.info('(Stop) Everything was successfully stopped.');
		}).catch(function (error) {
			LOG.error('(Stop) Catched error while stopping: ' + error);
		}).finally(function () {
			LOG.info('(Stop) Finally exitting.');
			process.exit();
		})
	});
});
