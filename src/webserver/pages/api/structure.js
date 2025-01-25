const FS = require('fs');
const LOG = require(BASE_DIR_GET('/src/libs/log.js'));
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
		/** @var {FolderItem|null} */
		const folderItem = res.locals.pathItem;
		if (folderItem?.isFolder !== true) {
			return res.result.setError('Invalid path or you dont have a permission.').end(403);
		}

		function generateSpecificFilePromise(filename) {
			return new Promise(function (resolve) {
				if (res.locals.user.testPathPermission(folderItem.path + filename) === false) { // user dont have permission to this file
					return resolve(null);
				}
				const fileAPathbsolute = res.locals.pathAbsolute + filename;
				FS.readFile(fileAPathbsolute, function (error, data) {
					if (error) {
						if (error.code !== 'ENOENT') { // some other error than just missing file
							LOG.error('Error while loading prepared thumbnail "' + fileAPathbsolute + '": ' + error)
						}
						return resolve(null)
					}
					resolve(data.toString());
				});
			});
		}

		const lastScanPromise = new Promise(function (resolve, reject) {
			structureRepository.getByPath(folderItem.path).then(function (pathItem) {
				resolve(pathItem ? pathItem.scanned : null);
			}).catch(function (error) {
				LOG.error('[Knex] Error while loading last scan for "' + folderItem + '": ' + error.message);
				reject(error);
			});
		});

		const options = {
			limit: req.query.limit !== undefined ? utils.clamp(parseInt(req.query.limit), 1, 2000) : 2000,
			offset: req.query.offset !== undefined ? utils.clamp(parseInt(req.query.offset)) : 0,
		};

		res.startTime('apistructure', 'Loading and processing data');
		Promise.all([
			getItemsHelper.itemsDb(folderItem.path, res.locals.user.getPermissions(), options),
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
			}).end(200);
		}).catch(function (error) {
			LOG.error('Error while loading structure for "' + folderItem + '": "' + error.message + '"');
			res.result.setError('Error while loading structure for "' + folderItem + '", try again later.').end(500);
		});
	});
};
