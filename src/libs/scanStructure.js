const CONFIG = require('./config.js');
const LOG = require('./log.js');
const FS = require('fs');
const pathCustom = require('./path.js');
const readdirp = require('readdirp');
const HFS = require(BASE_DIR_GET('/src/libs/helperFileSystem.js'));
const structureRepository = require('./repository/structure.js');

async function scan(path, options = {}) {
	options.exif = (typeof options.exif === 'boolean') ? options.exif : false;
	options.stat = (typeof options.stat === 'boolean') ? options.stat : false;
	if (module.exports.scanning) {
		LOG.warning('Scanning is already in progress, try again later.');
		return;
	}
	module.exports.scanning = true;
	let items = [];
	LOG.info('(ScanStructure) Scanning started for path "' + path + '" (options: ' + JSON.stringify(options) + ').');
	const readDirStartHr = process.hrtime();
	const scanStarted = new Date();

	let filesCount = 0;
	let foldersCount = 0;

	for await (const entry of readdirp(path, {
		type: 'files_directories',
		depth: CONFIG.structure.scan.depth,
		alwaysStat: options.stat,
		lstat: false,
	})) {
		if (CONFIG.structure.scan.itemCooldown) { // Wait before processing each item
			await new Promise(resolve => setTimeout(resolve, CONFIG.structure.scan.itemCooldown));
		}

		try {
			// dirent is available if alwaysStat=false
			const entryItem = entry.dirent || entry.stats;

			// If processed item is symbolic link, load stats for it to get real item (file or directory).
			// isSymbolicLink() is always false if readdirp() option alwaysStat is true
			let realEntryItem = entryItem;
			if (entryItem.isSymbolicLink()) {
				realEntryItem = FS.statSync(entry.fullPath);
			}

			if (realEntryItem.isFile() && entry.basename.match((new FileExtensionMapper).regexAll) === null) {
				continue; // file has invalid extension
			}

			let entryPath = pathCustom.absoluteToRelative(entry.fullPath, CONFIG.path);

			let resultItem = null;
			if (realEntryItem.isDirectory()) {
				resultItem = new FolderItem();
				foldersCount++;
			} else if (realEntryItem.isFile()) {
				resultItem = new FileItem();
				resultItem.size = realEntryItem.size || null;
				if (options.exif) {
					resultItem = Object.assign(resultItem, getCoordsFromExifFromFile(entry.fullPath));
				}
				filesCount++;
			} else {
				LOG.warning('Unhandled type of file, full path: "' + entry.fullPath + '"');
				continue;
			}
			resultItem.path = entryPath;
			resultItem.text = entryPath;
			resultItem.created = realEntryItem.ctimeMs || null;
			resultItem.scanned = new Date();

			if (resultItem instanceof FolderItem) {
				resultItem.path += '/';
				resultItem.text += '/';
			}
			items.push(resultItem);

			if (items.length > 0 && items.length % 1000 === 0) {
				let humanTime = msToHuman(hrtime(process.hrtime(readDirStartHr)));
				LOG.debug('(ScanStructure) So far scanned ' + filesCount + ' files and ' + foldersCount + ' folders in ' + humanTime + '.')
			}
		} catch (error) {
			LOG.error('(ScanStructure) Scanning throwed error while processing readdirp results: ' + error);
		}
	}
	let humanTime = msToHuman(hrtime(process.hrtime(readDirStartHr)));
	LOG.info('(ScanStructure) Scanning is done. Founded ' + filesCount + ' files and ' + foldersCount + ' folders in ' + humanTime + '.');
	await structureRepository.updateData(items, scanStarted)
	module.exports.scanning = false;
}

function getCoordsFromExifFromFile(fullPath) {
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

module.exports.scan = scan;
module.exports.scanning = false;
