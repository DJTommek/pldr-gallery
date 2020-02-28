const c = require(BASE_DIR_GET('/libs/config.js'));
const FS = require('fs');
const pathCustom = require(BASE_DIR_GET('/libs/path.js'));
const LOG = require(BASE_DIR_GET('/libs/log.js'));
const perms = require(BASE_DIR_GET('/libs/permissions.js'));
const HFS = require(BASE_DIR_GET('/libs/helperFileSystem.js'));
const globby = require('globby');

require(BASE_DIR_GET('/private/js/class/FileExtensionMapper.js'));
require(BASE_DIR_GET('/private/js/class/Icon.js'));
require(BASE_DIR_GET('/private/js/class/Item.js'));

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
			itemLimit = 1000;
		}

		let foldersLimitCount = 0;
		const loadFoldersPromise = new Promise(function (resolve) {
			let folders = [];
			// if requested folder is not root, add one FolderItem to go back
			if (res.locals.path !== '/') {
				folders.push(new FolderItem(null, {
					path: generateGoBackPath(res.locals.path),
					text: '..',
					noFilter: true,
					icon: (new Icon).FOLDER_GO_BACK,
				}).serialize());
			}
			// @TODO temporary fix, more info in https://github.com/DJTommek/pldr-gallery/issues/7
			globby(res.locals.fullPathFolder.replaceAll('(', '\\(') + '*', {
				markDirectories: true,
				onlyDirectories: true
			}).then(function (rawPathsFolders) {
				rawPathsFolders.forEach(function (fullPath) {
					const dynamicPath = pathCustom.absoluteToRelative(fullPath, c.path);
					if (perms.test(res.locals.userPerms, dynamicPath) === false) {
						return;
					}
					foldersLimitCount++;
					if (foldersLimitCount > itemLimit) {
						return;
					}
					folders.push(new FolderItem(null, {
						path: dynamicPath
					}).serialize());
				});
				folders.sort(sortItemsByPath);
			}).catch(function (error) {
				LOG.error('[Globby] Error while processing folders in "' + res.locals.fullPathFolder + '": ' + error.message);
				folders = [];
			}).finally(function () {
				resolve([folders, foldersLimitCount, itemLimit, 0]);
			});
		});

		let filesLimitCount = 0;
		const loadFilesPromise = new Promise(function (resolve) {
			let files = [];
			// @TODO temporary fix, more info in https://github.com/DJTommek/pldr-gallery/issues/7
			globby(res.locals.fullPathFolder.replaceAll('(', '\\(') + '*', {onlyFiles: true}).then(function (rawPathsFiles) {
				rawPathsFiles.forEach(function (fullPath) {
					const dynamicPath = pathCustom.absoluteToRelative(fullPath, c.path);
					if (perms.test(res.locals.userPerms, dynamicPath) === false) {
						return;
					}
					if (dynamicPath.match((new FileExtensionMapper).regexAll) === null) {
						return;
					}
					filesLimitCount++;
					if (filesLimitCount > itemLimit) {
						return;
					}
					let pathStats = null;
					try {
						pathStats = FS.lstatSync(fullPath);
					} catch (error) {
						LOG.error('[Globby] Error while processing file: "' + fullPath + '": ' + error.message);
						return;
					}
					let fileItem = new FileItem(null, {
						path: dynamicPath,
						size: pathStats.size,
						created: pathStats.ctime,
					});
					// try to load coordinates from EXIF and merge them into path data
					fileItem = Object.assign(fileItem, getCoordsFromExifFromFile(fullPath));
					files.push(fileItem.serialize());
				});
				files.sort(sortItemsByPath);
			}).catch(function (error) {
				LOG.error('[Globby] Error while processing files in "' + res.locals.fullPathFolder + '": ' + error.message);
				files = [];
			}).finally(function () {
				resolve([files, filesLimitCount, itemLimit, 0]);
			});
		});

		function generateSpecificFilePromise(filename) {
			return new Promise(function (resolve) {
				if (perms.test(res.locals.userPerms, res.locals.path + filename) === false) { // user dont have permission to this file
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

		Promise.all([
			loadFoldersPromise,
			loadFilesPromise,
			generateSpecificFilePromise('header.html'),
			generateSpecificFilePromise('footer.html'),
		]).then(function (data) {
			res.result.setResult({
				folders: data[0][0],
				foldersTotal: data[0][1],
				foldersLimit: data[0][2],
				foldersOffset: data[0][3],
				files: data[1][0],
				filesTotal: data[1][1],
				filesLimit: data[1][2],
				filesOffset: data[1][3],
				header: data[2],
				footer: data[3]
			}).end();
		});
	});

	function sortItemsByPath(a, b) {
		return a.path.toLowerCase().localeCompare(b.path.toLowerCase());
	}

	function getCoordsFromExifFromFile(fullPath) {
		try {
			return HFS.getCoordsFromExifFromFile(fullPath);
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
};
