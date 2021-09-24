const pathCustom = require(BASE_DIR_GET('/src/libs/path.js'));
const LOG = require(BASE_DIR_GET('/src/libs/log.js'));
const globby = require('globby');
const CONFIG = require(BASE_DIR_GET('/src/libs/config.js'));
const perms = require(BASE_DIR_GET('/src/libs/permissions.js'));
const FS = require('fs');
const HFS = require(BASE_DIR_GET('/src/libs/helperFileSystem.js'));
const knex = require(BASE_DIR_GET('src/libs/database.js'));


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

	return new Promise(function (resolve) {
		let filesLimitCount = 0;
		let files = [];
		// @TODO temporary fix, more info in https://github.com/DJTommek/pldr-gallery/issues/7
		let globbyPathPattern = fullPath.replaceAll('(', '\\(').replaceAll('[', '\\[');
		if (options.recursive === true) {
			globbyPathPattern += '**';
		} else {
			globbyPathPattern += '*';
		}
		globby(globbyPathPattern, {onlyFiles: true}).then(function (rawPathsFiles) {
			rawPathsFiles.forEach(function (fullPath) {
				const dynamicPath = pathCustom.absoluteToRelative(fullPath, CONFIG.path);
				if (perms.test(permissions, dynamicPath) === false) {
					return;
				}
				if (dynamicPath.match((new FileExtensionMapper).regexAll) === null) {
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

module.exports.filesDb = function (requestedPath, fullPath, permissions, options = {}) {
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

	return new Promise(function (resolve) {
		let filesLimitCount = 0;
		let files = [];
		const folderItem = new FolderItem(null, {
			path: requestedPath
		});

		const searchingLevel = folderItem.paths.length + 1;
		const query = knex.select('*')
			.from(CONFIG.db.table.structure)
			.where('type', 1)
		if (options.recursive) {
			query.andWhere('level', '>=', searchingLevel)
		} else {
			query.andWhere('level', searchingLevel)
		}
		query.andWhere('path', 'LIKE', requestedPath + '%')
		query.limit(options.limit);
		query.orderBy('path');
		console.log(query.toString());
		query.then(function (rows) {
			rows.forEach(function (row) {
				if (perms.test(permissions, row.path) === false) {
					return;
				}
				if (row.path.match((new FileExtensionMapper).regexAll) === null) {
					return;
				}
				filesLimitCount++;
				let fileItem = new FileItem(null, {
					path: row.path,
					size: row.size,
					created: row.created === null ? null : new Date(row.created),
				});
				if (row.coordinate_lat && row.coordinate_lon) {
					fileItem.coordLat = row.coordinate_lat;
					fileItem.coordLon = row.coordinate_lon;
				}
				files.push(fileItem);
			});
		}).catch(function (error) {
			LOG.error('[Knex] Error while loading and processing in "' + fullPath + '": ' + error.message);
			files = [];
		}).finally(function () {
			LOG.debug('(Knex) Files took ' + msToHuman(hrtime(process.hrtime(hrstart))) + '.', {console: true})
			resolve({
				items: files,
				total: filesLimitCount,
				limit: options.limit,
				offset: 0,
			});
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
		// if requested folder is not root, add one FolderItem to go back
		if (requestedPath !== '/') {
			folders.push(new FolderItem(null, {
				path: generateGoBackPath(requestedPath),
				text: '..',
				noFilter: true,
				icon: (new Icon).FOLDER_GO_BACK,
			}));
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

module.exports.foldersDb = function (requestedPath, fullPath, permissions, options = {}) {
	const hrstart = process.hrtime();
	if (typeof options.limit === 'undefined') {
		options.limit = null;
	} else if (options.limit !== null && typeof options.limit < 1) {
		throw new Error('Parameter "options.limit" must be positive number or false');
	}

	return new Promise(function (resolve) {
		let foldersLimitCount = 0;
		let folders = [];
		// if requested folder is not root, add one FolderItem to go back
		if (requestedPath !== '/') {
			folders.push(new FolderItem(null, {
				path: generateGoBackPath(requestedPath),
				text: '..',
				noFilter: true,
				icon: (new Icon).FOLDER_GO_BACK,
			}));
		}
		console.log(requestedPath);
		const folderItem = new FolderItem(null, {
			path: requestedPath
		});
		const query = knex.select('*')
			.from(CONFIG.db.table.structure)
			.where('type', 0)
			.andWhere('level', folderItem.paths.length + 1)
			.andWhere('path', 'LIKE', requestedPath + '%')
			.limit(options.limit)
			.orderBy('path');
		console.log(query.toString());
		query.then(function (rows) {
			rows.forEach(function (row) {
				if (perms.test(permissions, row.path) === false) {
					return;
				}
				foldersLimitCount++;
				folders.push(new FolderItem(null, {
					path: row.path
				}));
			});
			folders.sort(sortItemsByPath);
		}).catch(function (error) {
			LOG.error('[Globby] Error while processing folders in "' + fullPath + '": ' + error.message);
			folders = [];
		}).finally(function () {
			LOG.debug('(Knex) Folders took ' + msToHuman(hrtime(process.hrtime(hrstart))) + '.', {console: true})
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

