const c = require(BASE_DIR_GET('/libs/config.js'));
const FS = require('fs');
const pathCustom = require(BASE_DIR_GET('/libs/path.js'));
const LOG = require(BASE_DIR_GET('/libs/log.js'));
const readdirp = require('readdirp');
const HFS = require(BASE_DIR_GET('/libs/helperFileSystem.js'));
const perms = require(BASE_DIR_GET('/libs/permissions.js'));

module.exports = function (webserver, endpoint) {

	/**
	 * Run user search in all files and folders
	 * - case insensitive
	 * - search is performed in folder, what user has loaded (param path)
	 *
	 * @param query - searching string
	 * @param path - where to search
	 */
	webserver.get(endpoint, function (req, res) {
		res.statusCode = 200;
		res.setHeader("Content-Type", "application/json");
		let finds = {
			folders: [{ // always show "close searching" button
				path: res.locals.path,
				noFilter: true,
				text: 'Zavřít vyhledávání "' + req.query.query + '"',
				icon: (new Icon).CLOSE_SEARCHING,
			}],
			files: []
		};
		try {
			if (!req.query.query) {
				throw new Error('no search query');
			}
			if (!res.locals.fullPathFolder) {
				throw new Error('no path');
			}
		} catch (error) {
			res.result.setError('Error while searching: ' + error.message).end();
			return;
		}

		let logPrefix = '(Web) Searching "' + req.query.query + '" in path "' + res.locals.path + '"';
		let readDirStart = new Date();

		// Do not use readdirp.fileFilter option because is case sensitive.
		// Instead create custom file extensions regex with case-insensitive parameter
		// Closed github request, Option for case-insensitive filter: https://github.com/paulmillr/readdirp/issues/47
		readdirp(res.locals.fullPathFolder, {
			type: 'files_directories',
			depth: 10,
			alwaysStat: false
		}).on('data', function (entry) {
			try {
				// fallback to stats because dirent is not supported (probably node.js version is older than 10.10.0)
				// https://github.com/paulmillr/readdirp/issues/95
				// https://nodejs.org/api/fs.html#fs_class_fs_dirent
				const item = entry.dirent || entry.stats;

				if (item.isFile() && entry.basename.match((new FileExtensionMapper).regexAll) === null) {
					return; // file has invalid extension
				}

				let entryPath = pathCustom.absoluteToRelative(entry.fullPath, c.path);
				if (entry.basename.toLowerCase().includes(req.query.query.toLowerCase()) === false) {
					return; // not match with searched query
				}

				if (perms.test(res.locals.userPerms, entryPath) === false) {
					return; // user dont have permission to this item
				}

				let pathData = {
					path: entryPath,
					text: entryPath
				};
				if (item.isDirectory()) {
					pathData.path += '/';
					finds.folders.push(pathData);
				} else { // is file, load detailed info
					let pathStats = FS.lstatSync(entry.fullPath);
					pathData.size = pathStats.size;
					pathData.created = pathStats.ctime;
					pathData = Object.assign(pathData, getCoordsFromExifFromFile(entry.fullPath));
					finds.files.push(pathData);
				}
			} catch (error) {
				LOG.error(logPrefix + ' throwed error while processing readdirp results: ' + error);
			}
		}).on('warn', function (warning) {
			LOG.warning(logPrefix + ' throwed warning: ' + warning);
		}).on('error', function (error) {
			LOG.error(logPrefix + ' throwed error: ' + error);
		}).on('end', function () {
			let humanTime = msToHuman(new Date() - readDirStart);
			LOG.info(logPrefix + ' is done in ' + humanTime + ', founded ' + finds.folders.length + ' folders and ' + finds.files.length + ' files.');
			res.result.setResult(finds, 'Done in ' + humanTime).end();
		});
	});

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
