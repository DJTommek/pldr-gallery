const FS = require('fs');
const LOG = require(BASE_DIR_GET('/src/libs/log.js'));
const structureRepository = require('../../../libs/repository/structure');

require(BASE_DIR_GET('/src/webserver/private/js/class/FileExtensionMapper.js'));
require(BASE_DIR_GET('/src/webserver/private/js/class/Icon.js'));
require(BASE_DIR_GET('/src/webserver/private/js/class/Item.js'));
const utils = require('../../../libs/utils/utils');
const sqlUtils = require("../../../libs/repository/sqlUtils.js");

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
			loadStructure(folderItem, res.locals.user.getPermissions(), options),
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

/**
 * @param {FolderItem} directoryItem
 * @param {array<string>} permissionsPaths
 * @param {object} options
 * @return {Promise<unknown>}
 */
function loadStructure(directoryItem, permissionsPaths, options = {}) {
	const result = {
		files: [],
		folders: [],
		limit: options.limit,
		offset: options.offset,
	};

	const requestedLimit = options.limit || 2000;
	const requestedOffset = options.offset || 0;

	if (directoryItem.path !== '/') { // if requested folder is not root, add one FolderItem to go back
		result.folders.push(generateGoBackFolderItem(directoryItem));
	}

	return new Promise(async function (resolve) {
		const query = structureRepository.structure(directoryItem)
			.limit(requestedLimit)
			.offset(requestedOffset)
			.orderBy(['type', 'path']);

		// Build list of permissions path, that are valid for requested directory level
		// @TODO Optimize by removing permissions, that starts differently than requested directory
		const permissionsQueriedPaths = [];
		const searchingLevel = directoryItem.paths.length + 2;
		for (const permissionPath of permissionsPaths) {
			const pathParts = permissionPath.split('/');
			const queriedPath = pathParts.slice(0, searchingLevel).join('/');
			if (permissionsQueriedPaths.includes(queriedPath)) {
				continue;
			}
			permissionsQueriedPaths.push(queriedPath);
		}

		query.andWhere(function () {
			for (const permissionQueryPath of permissionsQueriedPaths) {
				// 'orWhereLike()' cannot be used due to bug of forcing COLLATE, which slows down the query
				// @link https://github.com/knex/knex/issues/5143 whereLike does not work with the MySQL utf8mb4 character set
				this.orWhere('path', 'LIKE', sqlUtils.escapeLikeCharacters(permissionQueryPath) + '%');
			}
		});

		try {
			for (const row of await query) {
				const item = structureRepository.rowToItem(row);
				if (item.isFolder) {
					result.folders.push(item);
				} else if (item.isFile) {
					result.files.push(item);
				}
			}
		} catch (error) {
			LOG.error('[Knex] Error while loading and processing structure in "' + directoryItem + '": ' + error.message);
		} finally {
			resolve(result);
		}
	});
}

/**
 * @param {FolderItem} directoryItem
 * @returns
 */
function generateGoBackFolderItem(directoryItem) {
	return new FolderItem(null, {
		path: generateGoBackPath(directoryItem.path),
		text: '..',
		noFilter: true,
		icon: Icon.FOLDER_GO_BACK,
	});
}
