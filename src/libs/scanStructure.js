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

	const readdirpOptions = {
		type: 'files_directories',
		depth: CONFIG.structure.scan.depth,
		alwaysStat: options.stat,
		lstat: false,
	};

	if (CONFIG.structure.scan.ignoreDirectories.length !== 0) {
		readdirpOptions.directoryFilter = function(directoryEntry) {
			const path = '/' + directoryEntry.path.replaceAll('\\', '/') + '/';
			return CONFIG.structure.scan.ignoreDirectories.includes(path) === false;
		};
	}

	const entriesStream = readdirp(absolutePath, readdirpOptions);

	// @HACK to include current directory into scan too
	entriesStream.push({
		path: pathCustom.absoluteToRelative(absolutePath, CONFIG.path).replace(/^\/|\/$/g, ''), // empty string if relative root
		fullPath: absolutePath.replace(/\/$/g, ''),
		basename: PATH.basename(absolutePath),
		stats: FS.statSync(absolutePath),
	});

	for await (const entry of entriesStream) {
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
				resultItem.size = ['bigint', 'number'].includes(typeof realEntryItem.size) ? realEntryItem.size : null;
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

			if (items.length > 0 && items.length % 2000 === 0) {
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
		const errorPrefix = '(Metadata) Error while loading metadata from file "' + fullPath + '": ';
		if (error.message.includes('ffprobe exited with code')) {
			// handle ffprobe-related errors manually, because all errors are huge multi-line strings, containing
			// info about ffmpeg version, build settings, etc
			if (error.message.trim().includes('moov atom not found')) {
				LOG.warning(errorPrefix + '"moov atom not found". File seems to be corrupted, is it still playable?');
			} else if (error.message.trim().includes('ffprobe was killed with signal SIGFPE')) { // @TODO what the heck is this error?
				LOG.debug(errorPrefix + '"ffprobe was killed with signal SIGFPE"');
			} else {
				LOG.error(errorPrefix + error);
			}
		} else if (error.message.startsWith('Invalid format while decoding: ')) { // example of full error: "Invalid format while decoding: 28521"
			// ignore
		} else if (error.message === 'Index out of range') {
			LOG.warning(errorPrefix + '"Index out of range". Tip: increase buffer size for this excension.');
		} else if (error.message === 'Invalid JPEG section offset') {
			// ignore, probably broken image and/or EXIF data, more info in https://github.com/bwindels/exif-parser/issues/13
		} else if (error.message === 'This file extension is not allowed to load metadata from.') {
			// ignore
		} else {
			LOG.error('(Metadata) Error while loading metadata from file "' + fullPath + '": ' + error);
		}
	}
	return {}
}

module.exports.scan = scan;
module.exports.scanning = false;
