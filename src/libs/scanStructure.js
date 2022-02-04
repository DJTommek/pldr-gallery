const CONFIG = require('./config.js');
const LOG = require('./log.js');
const FS = require('fs');
const PATH = require('path');
const pathCustom = require('./path.js');
const readdirp = require('readdirp');
const HFS = require(BASE_DIR_GET('/src/libs/helperFileSystem.js'));
const structureRepository = require('./repository/structure.js');

async function scan(absolutePath, options = {}) {
	options.exif = (typeof options.exif === 'boolean') ? options.exif : false;
	options.stat = (typeof options.stat === 'boolean') ? options.stat : false;
	if (module.exports.scanning) {
		LOG.warning('Scanning is already in progress, try again later.');
		return;
	}
	module.exports.scanning = true;
	let items = [];
	LOG.info('(ScanStructure) Scanning started for path "' + absolutePath + '" (options: ' + JSON.stringify(options) + ').');
	const readDirStartHr = process.hrtime();
	const scanStarted = new Date();

	let filesCount = 0;
	let foldersCount = 0;

	const entries = readdirp(absolutePath, {
		type: 'files_directories',
		depth: CONFIG.structure.scan.depth,
		alwaysStat: options.stat,
		lstat: false,
	});

	// @HACK to include current directory into scan too
	entries.push({
		path: pathCustom.absoluteToRelative(absolutePath, CONFIG.path).replace(/^\/|\/$/g, ''), // empty string if relative root
		fullPath: absolutePath.replace(/\/$/g, ''),
		basename: PATH.basename(absolutePath),
		stats: FS.statSync(absolutePath),
	});

	for await (const entry of entries) {
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

			if (realEntryItem.isFile() && entry.basename.match(FileExtensionMapperInstance.regexAll) === null) {
				continue; // file has invalid extension
			}

			const entryPath = entry.path === '' ? '' : pathCustom.absoluteToRelative(entry.fullPath, CONFIG.path);

			let resultItem = null;
			if (realEntryItem.isDirectory()) {
				const pathToItem = entryPath + '/';
				resultItem = new FolderItem(null, {path: pathToItem});
				foldersCount++;
			} else if (realEntryItem.isFile()) {
				resultItem = new FileItem(null, {path: entryPath});
				resultItem.size = realEntryItem.size || null;
				if (options.exif) {
					const exifData = await getCoordsFromExifFromFile(entry.fullPath);
					resultItem = Object.assign(resultItem, exifData);
				}
				filesCount++;
			} else {
				LOG.warning('Unhandled type of file, full path: "' + entry.fullPath + '"');
				continue;
			}
			resultItem.created = realEntryItem.ctimeMs || null;
			resultItem.scanned = new Date();

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
	await structureRepository.updateData(absolutePath, items, scanStarted)
	module.exports.scanning = false;
}

async function getCoordsFromExifFromFile(fullPath) {
	try {
		return await HFS.getDataFromExifFromFile(fullPath);
	} catch (error) {
		if (error.message === 'Index out of range') {
			LOG.warning('Number of bytes is too small buffer for loading EXIF from file "' + fullPath + '".');
		} else if (error.message === 'Invalid JPEG section offset') {
			// ignore, probably broken image and/or EXIF data, more info in https://github.com/bwindels/exif-parser/issues/13
		} else if (error.message === 'This file extension is not allowed to load metadata from.') {
			// skip loading
		} else {
			LOG.error('Error while loading coordinates from EXIF for file "' + fullPath + '": ' + error);
		}
	}
	return {}
}

module.exports.scan = scan;
module.exports.scanning = false;
