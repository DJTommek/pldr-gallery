require('./webserver/private/js/functions.js');
const pathCustom = require('./libs/path.js');
pathCustom.defineBaseDir(require.main.filename);
const scanStructure = require('./libs/scanStructure.js');
const FS = require("fs");
const CONFIG = require('./libs/config.js');
const CronJob = require('cron').CronJob;

(async function () {
	const LOG = require('./libs/log.js');
	const perms = require('./libs/permissions.js');

	// Check if config.path is set correctly
	try {
		let folderStats = FS.statSync(CONFIG.path);
		if (folderStats.isDirectory() === false) {
			throw new Error('it is not directory');
		}
		let items = FS.readdirSync(CONFIG.path);
		if (items.length === 0) {
			throw new Error('no items in base folder');
		}
		LOG.info('(Start) Defined base path "' + CONFIG.path + '" is valid with ' + items.length + ' items.');
	} catch (error) {
		LOG.fatal('(Start) Defined base path "' + CONFIG.path + '" is invalid. Error: ' + error.message);
	}

	LOG.info('***STARTING***');

	try {
		await perms.load();
	} catch (error) {
		LOG.fatal('(Permissions) Error while loading permissions: ' + error.message)
	}

	// Start webserver(s)
	const webserver = require('./webserver/webserver.js');

	if (CONFIG.structure.scan.enable) {
		if (CONFIG.structure.scan.fast.onStart) { // run fast scan and then deep scan if allowed
			scanStructure.scan(CONFIG.path, {stat: false, exif: false}, function () {
				if (CONFIG.structure.scan.deep.onStart) {
					scanStructure.scan(CONFIG.path, {stat: true, exif: true});
				}
			});
		} else if (CONFIG.structure.scan.deep.onStart) { // run deep scan only
			scanStructure.scan(CONFIG.path, {stat: true, exif: true});
		}
		if (CONFIG.structure.scan.fast.cron) {
			new CronJob(CONFIG.structure.scan.fast.cron, function () {
				LOG.info('Job tick for structure fast scan.')
				scanStructure.scan(CONFIG.path, {stat: false, exif: false});
			}).start();
		}
		if (CONFIG.structure.scan.deep.cron) {
			new CronJob(CONFIG.structure.scan.deep.cron, function () {
				LOG.info('Job tick for structure deep scan.')
				scanStructure.scan(CONFIG.path, {stat: true, exif: true});
			}).start();
		}
	}

	CONFIG.stop.events.forEach(function (signalCode) {
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
						reject('Closing HTTP server timeouted after ' + CONFIG.stop.timeout + 'ms.');
					}, CONFIG.stop.timeout);
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
						reject('Closing HTTPS server timeouted after ' + CONFIG.stop.timeout + 'ms.');
					}, CONFIG.stop.timeout);
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
}());
