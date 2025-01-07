const pathCustom = require(BASE_DIR_GET('/src/libs/path.js'));
const LOG = require(BASE_DIR_GET('/src/libs/log.js'));
const CONFIG = require(BASE_DIR_GET('/src/libs/config.js'));
const perms = require(BASE_DIR_GET('/src/libs/permissions.js'));
const FS = require('fs');
const HFS = require(BASE_DIR_GET('/src/libs/helperFileSystem.js'));
const structureRepository = require('../../../../libs/repository/structure');


module.exports.files = function (requestedPath, fullPath, permissions, options = {}) {
	const hrstart = process.hrtime();
	if (typeof options.limit === 'undefined') {
		options.limit = false;
	} else if (options.limit !== false && typeof options.limit < 1) {
		throw new Error('Parameter "options.limit" must be positive number or false');
	}

	if (typeof options.recursive === 'undefined') {
		options.recursive = false;
	} else if (typeof options.recursive !== 'boolean') {
		throw new Error('Parameter "options.recursive" must be boolean');
	}

	if (typeof options.exif === 'undefined') {
		options.exif = false;
	} else if (typeof options.exif !== 'boolean') {
		throw new Error('Parameter "options.exif" must be boolean');
	}

	if (typeof options.stat === 'undefined') {
		options.stat = false;
	} else if (typeof options.stat !== 'boolean') {
		throw new Error('Parameter "options.stat" must be boolean');
	}

	return new Promise(async function (resolve) {
		let filesLimitCount = 0;
		let files = [];
		// @TODO temporary fix, more info in https://github.com/DJTommek/pldr-gallery/issues/7
		let globbyPathPattern = fullPath.replaceAll('(', '\\(').replaceAll('[', '\\[');
		if (options.recursive === true) {
			globbyPathPattern += '**';
		} else {
			globbyPathPattern += '*';
		}
		const globby = await import('globby');
		globby(globbyPathPattern, {onlyFiles: true}).then(function (rawPathsFiles) {
			rawPathsFiles.forEach(function (fullPath) {
				const dynamicPath = pathCustom.absoluteToRelative(fullPath, CONFIG.path);
				if (perms.test(permissions, dynamicPath) === false) {
					return;
				}
				if (dynamicPath.match(FileExtensionMapperInstance.regexAll) === null) {
					return;
				}
				filesLimitCount++;
				if (options.limit !== false && filesLimitCount > options.limit) {
					return;
				}
				let pathStats = null;
				if (options.stat === true) {
					try {
						pathStats = FS.lstatSync(fullPath);
					} catch (error) {
						LOG.error('[Globby] Error while processing file: "' + fullPath + '": ' + error.message);
						return;
					}
				}
				let fileItem = new FileItem(null, {
					path: dynamicPath,
					size: pathStats ? pathStats.size : 0,
					created: pathStats ? pathStats.ctime : new Date(0),
				});
				if (options.exif === true) {
					// try to load coordinates from EXIF and merge them into path data
					fileItem = Object.assign(fileItem, getDataFromExifFromFile(fullPath));
				}
				files.push(fileItem);
			});
			files.sort(sortItemsByPath);
		}).catch(function (error) {
			LOG.error('[Globby] Error while processing files in "' + fullPath + '": ' + error.message);
			files = [];
		}).finally(function () {
			LOG.debug('(FS Stats) Pattern: "' + globbyPathPattern + '", total ' + filesLimitCount + ' files, took ' + msToHuman(hrtime(process.hrtime(hrstart))) + ' (options.coords=' + (options.exif ? 'true' : 'false') + ').', {console: false})
			resolve({
				items: files,
				total: filesLimitCount,
				limit: options.limit,
				offset: 0,
			});
		});
	});
};

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

module.exports.folders = function (requestedPath, fullPath, permissions, options = {}) {
	const hrstart = process.hrtime();
	if (typeof options.limit === 'undefined') {
		options.limit = false;
	} else if (options.limit !== false && typeof options.limit < 1) {
		throw new Error('Parameter "options.limit" must be positive number or false');
	}

	return new Promise(function (resolve) {
		let foldersLimitCount = 0;
		let folders = [];
		if (requestedPath !== '/') { // if requested folder is not root, add one FolderItem to go back
			folders.push(generateGoBackFolderItem(requestedPath));
		}
		const globbyPathPattern = fullPath.replaceAll('(', '\\(').replaceAll('[', '\\[') + '*'
		// @TODO temporary fix, more info in https://github.com/DJTommek/pldr-gallery/issues/7
		globby(globbyPathPattern, {
			markDirectories: true,
			onlyDirectories: true
		}).then(function (rawPathsFolders) {
			rawPathsFolders.forEach(function (fullPath) {
				const dynamicPath = pathCustom.absoluteToRelative(fullPath, CONFIG.path);
				if (perms.test(permissions, dynamicPath) === false) {
					return;
				}
				foldersLimitCount++;
				if (options.limit !== false && foldersLimitCount > options.limit) {
					return;
				}
				folders.push(new FolderItem(null, {
					path: dynamicPath
				}));
			});
			folders.sort(sortItemsByPath);
		}).catch(function (error) {
			LOG.error('[Globby] Error while processing folders in "' + fullPath + '": ' + error.message);
			folders = [];
		}).finally(function () {
			LOG.debug('(FS Stats) Pattern: "' + globbyPathPattern + '", total ' + foldersLimitCount + ' folders, took ' + msToHuman(hrtime(process.hrtime(hrstart))) + '.', {console: false})
			resolve({
				items: folders,
				total: foldersLimitCount,
				limit: options.limit,
				offset: 0,
			});
		});
	});
};

function getDataFromExifFromFile(fullPath) {
	try {
		return HFS.getDataFromExifFromFile(fullPath);
	} catch (error) {
		if (error.message === 'Index out of range') {
			LOG.warning('Number of bytes is too small buffer for loading EXIF from file "' + fullPath + '".');
		} else if (error.message === 'Invalid JPEG section offset') {
			// ignore, probably broken image and/or EXIF data, more info in https://github.com/bwindels/exif-parser/issues/13
		} else if (error.message === 'This file extension is not allowed to load EXIF data from.') {
			// skip loading
		} else {
			LOG.error('Error while loading coordinates from EXIF for file "' + fullPath + '": ' + error);
		}
	}
	return {}
}

function sortItemsByPath(a, b) {
	return a.path.toLowerCase().localeCompare(b.path.toLowerCase());
}

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
