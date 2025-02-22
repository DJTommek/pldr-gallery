require('./webserver/private/js/functions.js');
const pathCustom = require('./libs/path.js');
pathCustom.defineBaseDir(require.main.filename);
const scanStructure = require('./libs/scanStructure.js');
const FS = require("fs");
const CONFIG = require('./libs/config.js');
const CronJob = require('cron').CronJob;
const chokidar = require('chokidar');
const structureRepository = require('./libs/repository/structure.js');
const thumbnailGenerator = require('./libs/thumbnailGenerator.js');
const fileGenerators = require('./webserver/fileGenerators.js');
const cacheHelper = require("./webserver/pages/api/helpers/cache");
const sharp = require("sharp");
const LOG = require("./libs/log");

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

	// Validate defined allowed extensions in upload
	const invalidAllowedExtensions = [];
	for (const allowedExtension of CONFIG.upload.allowedExtensions) {
		const mediaType = FileExtensionMapperInstance.getMediaType(allowedExtension);
		if (mediaType === null) {
			invalidAllowedExtensions.push(allowedExtension);
		}
	}
	if (invalidAllowedExtensions.length > 0) {
		LOG.warning('[Config - upload] ' + CONFIG.upload.allowedExtensions.length + ' file extensions are allowed but ' + invalidAllowedExtensions.length + ' of them are not matched to media type. Server validation will accept these files but frontend validation will refuse them. Full list of invalid extensions: "' + invalidAllowedExtensions.join('", "') + '"');
	}

	LOG.info('***STARTING***');

	try {
		await perms.load();
	} catch (error) {
		LOG.fatal('(Permissions) Error while loading permissions: ' + error.message)
	}

	// Start webserver(s)
	const webserver = require('./webserver/webserver.js');

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

	// Run fast scan on start and then deep scan if allowed
	if (CONFIG.structure.scan.fast.onStart) {
		await scanStructure.scan(CONFIG.path, {stat: false, exif: false});
		if (CONFIG.structure.scan.deep.onStart) {
			await scanStructure.scan(CONFIG.path, {stat: true, exif: true});
			await fileGenerators.generateIndexHtml();
		}
	} else if (CONFIG.structure.scan.deep.onStart) { // run deep scan only
		await scanStructure.scan(CONFIG.path, {stat: true, exif: true});
		await fileGenerators.generateIndexHtml();
	}
	// setup fast scan cron
	if (CONFIG.structure.scan.fast.cron) {
		new CronJob(CONFIG.structure.scan.fast.cron, async function () {
			LOG.info('Job tick for structure fast scan.')
			await scanStructure.scan(CONFIG.path, {stat: false, exif: false});
		}).start();
	}
	// setup deep scan cron
	if (CONFIG.structure.scan.deep.cron) {
		new CronJob(CONFIG.structure.scan.deep.cron, async function () {
			LOG.info('Job tick for structure deep scan.')
			await scanStructure.scan(CONFIG.path, {stat: true, exif: true});
			await fileGenerators.generateIndexHtml();
		}).start();
	}

	// Pre-generate thumbnails for all files
	if (
		CONFIG.thumbnails.image.enabled === true
		|| CONFIG.thumbnails.folder.enabled === true
		|| CONFIG.thumbnails.video.enabled === true
	) {
		if (CONFIG.thumbnails.pregenerate.cron !== null) {
			new CronJob(CONFIG.thumbnails.pregenerate.cron, async function () {
				LOG.debug('[CRON] Thumbnail generator: job tick');
				try {
					await thumbnailGenerator.generateThumbnails();
					LOG.debug('[CRON] Thumbnail generator: done');
				} catch (error) {
					LOG.error('[CRON] Thumbnail generator: error: "' + error.message + '"');
				}
			}).start();
			LOG.debug('Setup cron "' + CONFIG.thumbnails.pregenerate.cron + '" to pregenerate thumbnails completed.');
		}
		if (CONFIG.thumbnails.pregenerate.onStart) {
			setTimeout(function () {
				// There are more services that should be completed before processing thumbnails, so wait a while.
				// @TODO Refactor server start so it can be defined startup order of these services
				LOG.info('Pregenerating image thumbnails on server start...')
				thumbnailGenerator.generateThumbnails().then(function () {
					LOG.info('Pregenerating image thumbnails on server start was completed.')
				}).catch(function (error) {
					LOG.error('Pregenerating image thumbnails on server start throwed error: "' + error.message + '"')
				});
			}, 30_000);
		}
	}

	if (CONFIG.structure.watch.enable) { // Watch for file and folder changes and update structure in database
		chokidar.watch(CONFIG.path, {
			ignoreInitial: true,
			disableGlobbing: true,
			alwaysStat: true,
			awaitWriteFinish: true,
			cwd: CONFIG.path,
		}).on('add', function (relativePath, stats) {
			// @TODO do not add files, that extensions are not whitelisted
			relativePath = '/' + pathCustom.join(relativePath);
			LOG.debug('Detected new file "' + relativePath + '", adding to structure database...');
			const fileItem = new FileItem(null, {
				path: relativePath,
				scanned: new Date(),
				created: stats.ctimeMs ? new Date(stats.ctimeMs) : null,
			});
			structureRepository.add(fileItem);
		}).on('unlink', function (relativePath) {
			relativePath = '/' + pathCustom.join(relativePath);
			LOG.debug('Detected deleted file "' + relativePath + '", removing from structure database...');
			structureRepository.remove(relativePath);
		}).on('addDir', function (relativePath, stats) {
			relativePath = '/' + pathCustom.join(relativePath) + '/';
			LOG.debug('Detected new folder "' + relativePath + '", adding to structure database...');
			const folderItem = new FolderItem(null, {
				path: relativePath,
				scanned: new Date(),
				created: stats.ctimeMs ? new Date(stats.ctimeMs) : null,
			})
			structureRepository.add(folderItem);
		}).on('unlinkDir', function (relativePath) {
			relativePath = '/' + pathCustom.join(relativePath) + '/';
			LOG.debug('Detected deleted folder "' + relativePath + '", removing from structure database...');
			structureRepository.remove(relativePath);
		}).on('error', function (error) {
			LOG.error('(Chokidar) Error while watching: "' + error.message + '"');
		});
	}
}());
