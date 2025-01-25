const LOG = require(BASE_DIR_GET('/src/libs/log.js'));
const perms = require(BASE_DIR_GET('/src/libs/permissions.js'));
const structureRepository = require('../../../../libs/repository/structure');

module.exports.itemsDb = function (requestedPath, fullPath, permissions, options = {}) {
	const hrstart = process.hrtime();
	if (typeof options.limit === 'undefined') {
		options.limit = null;
	} else if (options.limit !== null && typeof options.limit < 1) {
		throw new Error('Parameter "options.limit" must be positive number or false');
	}

	if (typeof options.recursive === 'undefined') {
		options.recursive = false;
	} else if (typeof options.recursive !== 'boolean') {
		throw new Error('Parameter "options.recursive" must be boolean');
	}

	/**
	 * @param {FolderItem|FileItem} pathItem
	 * @returns {boolean}
	 */
	function filterPathItems(pathItem) {
		if (perms.test(permissions, pathItem.path) === false) {
			return false;
		} else if (pathItem.isFile && pathItem.path.match(FileExtensionMapperInstance.regexAll) === null) {
			return false;
		} else {
			return true;
		}
	}

	const result = {
		files: [],
		folders: [],
		limit: options.limit,
		offset: 0,
	};

	const requestedLimit = options.limit || 2000;
	const requestedOffset = options.offset || 0;
	let processedOffset = 0;

	let goBackIndexCount = 0;
	if (requestedPath !== '/') { // if requested folder is not root, add one FolderItem to go back
		result.folders.push(generateGoBackFolderItem(requestedPath));
		goBackIndexCount = 1;
	}

	return new Promise(function (resolve) {
		structureRepository.loadByPath(requestedPath).then(function (pathItems) {
			pathItems = pathItems.filter(filterPathItems);
			for (const item of pathItems) {
				// do not count 'go back' directory (if available)
				const alreadyCollectedItemsCount = result.folders.length - goBackIndexCount + result.files.length;

				if (alreadyCollectedItemsCount >= requestedLimit) {
					break; // already collected enough of items
				}

				if (processedOffset < requestedOffset) {
					processedOffset++;
					continue; // still not within range (>= offset and <= offset + limit)
				}

				if (item instanceof FileItem) {
					result.files.push(item);
				} else if (item instanceof FolderItem) {
					result.folders.push(item);
				}
			}
		}).catch(function (error) {
			LOG.error('[Knex] Error while loading and processing in "' + fullPath + '": ' + error.message);
		}).finally(function () {
			LOG.debug('(Knex) Loading items took ' + msToHuman(hrtime(process.hrtime(hrstart))) + '.', {console: true})
			resolve(result);
		});
	});
};

/**
 * @param {string} requestedPath
 * @returns
 */
function generateGoBackFolderItem(requestedPath) {
	return new FolderItem(null, {
		path: generateGoBackPath(requestedPath),
		text: '..',
		noFilter: true,
		icon: Icon.FOLDER_GO_BACK,
	});
}
