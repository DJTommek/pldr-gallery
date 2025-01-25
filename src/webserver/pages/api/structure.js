const FS = require('fs');
const LOG = require(BASE_DIR_GET('/src/libs/log.js'));
const perms = require(BASE_DIR_GET('/src/libs/permissions.js'));
const structureRepository = require('../../../libs/repository/structure');

const getItemsHelper = require(__dirname + '/helpers/getItemsFromFolder.js');

require(BASE_DIR_GET('/src/webserver/private/js/class/FileExtensionMapper.js'));
require(BASE_DIR_GET('/src/webserver/private/js/class/Icon.js'));
require(BASE_DIR_GET('/src/webserver/private/js/class/Item.js'));
const utils = require('../../../libs/utils/utils');

module.exports = function (webserver, endpoint) {

	/**
	 * Load list items (of files and folders) from given path
	 *
	 * @returns JSON
	 */
	webserver.get(endpoint, function (req, res) {
		res.statusCode = 200;
		res.setHeader("Content-Type", "application/json");
		if (!res.locals.fullPathFolder) {
			res.result.setError('Zadaná cesta "<b>' + res.locals.queryPath + '</b>" není platná nebo na ni nemáš právo.').end();
			return;
		}

		let itemLimit = parseInt(req.cookies['pmg-item-limit']);
		if (itemLimit <= 0) {
			itemLimit = 2000;
		}

		function generateSpecificFilePromise(filename) {
			return new Promise(function (resolve) {
				if (res.locals.user.testPathPermission(res.locals.path + filename) === false) { // user dont have permission to this file
					return resolve(null);
				}
				FS.readFile(res.locals.fullPathFolder + filename, function (error, data) {
					if (error) {
						if (error.code !== 'ENOENT') { // some other error than just missing file
							LOG.error('Error while loading "' + res.locals.path + filename + '": ' + error)
						}
						return resolve(null)
					}
					resolve(data.toString());
				});
			});
		}

		const lastScanPromise = new Promise(function (resolve, reject) {
			structureRepository.getByPath(res.locals.path).then(function (pathItem) {
				resolve(pathItem ? pathItem.scanned : null);
			}).catch(function (error) {
				LOG.error('[Knex] Error while loading last scan for "' + res.locals.path + '": ' + error.message);
				reject(error);
			});
		});

		const options = {
			limit: req.query.limit !== undefined ? utils.clamp(parseInt(req.query.limit), 1, 2000) : 2000,
			offset: req.query.offset !== undefined ? utils.clamp(parseInt(req.query.offset)) : 0,
		};

		res.startTime('apistructure', 'Loading and processing data');
		Promise.all([
			getItemsHelper.itemsDb(res.locals.path, res.locals.user.getPermissions(), options),
			lastScanPromise,
			generateSpecificFilePromise('header.html'),
			generateSpecificFilePromise('footer.html'),
		]).then(function (data) {
			res.endTime('apistructure');
			res.result.setResult({
				folders: data[0].folders.map(x => x.serialize()),
				foldersTotal: data[0].folders.total,
				foldersLimit: data[0].limit,
				foldersOffset: data[0].offset,
				files: data[0].files.map(x => x.serialize()),
				filesTotal: data[0].files.total,
				filesLimit: data[0].limit,
				filesOffset: data[0].offset,
				lastScan: data[1],
				header: data[2],
				footer: data[3]
			}).end();
		}).catch(function (error) {
			res.result.setError('Error while loading "<b>' + res.locals.queryPath + '</b>". Try again later or contact administrator.').end();
		});
	});
};
