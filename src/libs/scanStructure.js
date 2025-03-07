const CONFIG = require('./config.js');
const LOG = require('./log.js');
const FS = require('fs');
const FSP = require('fs/promises');
const PATH = require('path');
const pathCustom = require('./path.js');
const readdirp = require('readdirp');
const HFS = require(BASE_DIR_GET('/src/libs/helperFileSystem.js'));
const structureRepository = require('./repository/structure.js');
const Utils = require('../libs/utils/utils.js');

/**
 * Recursively scan directory and synchronize results into database.
 *
 * @param absolutePathToScan
 * @param options
 *    `stat` (bool) load also file stats (scan will be slower), default false
 *    `exif` (bool) load also EXIF metadata (scan will be slower), default false
 * @return {Promise<void>}
 */
async function scan(absolutePathToScan, options = {}) {
	options.exif = (typeof options.exif === 'boolean') ? options.exif : false;
	options.stat = (typeof options.stat === 'boolean') ? options.stat : false;

	if (module.exports.scanning) {
		LOG.warning('Scanning is already in progress, try again later.');
		return;
	}
	module.exports.scanning = true;
	LOG.info('(ScanStructure) Scanning started for path "' + absolutePathToScan + '" (options: ' + JSON.stringify(options) + ').');
	const scanStarted = new Date();
	const items = await scanRecursive(absolutePathToScan, options);
	const relativePathToScan = pathCustom.absoluteToRelative(absolutePathToScan, CONFIG.path);
	await structureRepository.updateData(relativePathToScan, items, scanStarted)
	module.exports.scanning = false;
}

/**
 * Recursively scan directory and return list of scanned items.
 *
 * @param {string} absolutePathToScan
 * @param {object} options
 *     `stat` (bool) load also file stats (scan will be slower), default false
 *     `exif` (bool) load also EXIF metadata (scan will be slower), default false
 * @return {Promise<array<FolderItem|FileItem>>}
 */
async function scanRecursive(absolutePathToScan, options = {}) {
	options.exif = (typeof options.exif === 'boolean') ? options.exif : false;
	options.stat = (typeof options.stat === 'boolean') ? options.stat : false;
	const scanOneOptions = Object.assign({save: false}, options);

	let items = [];
	const readDirStartHr = process.hrtime();

	const readdirpOptions = {
		type: 'files_directories',
		depth: CONFIG.structure.scan.depth,
		alwaysStat: options.stat,
		lstat: false,
	};

	if (CONFIG.structure.scan.ignoreDirectories.length !== 0) {
		readdirpOptions.directoryFilter = function (directoryEntry) {
			const path = '/' + directoryEntry.path.replaceAll('\\', '/') + '/';
			return CONFIG.structure.scan.ignoreDirectories.includes(path) === false;
		};
	}


	// Include current directory into scan too
	const currentDirectoryItem = await scanOne(absolutePathToScan, FS.statSync(absolutePathToScan), scanOneOptions);
	if (options.stat === false) {
		// @HACK When inserting metadata into database, knex will generate batch insert query, that will contains all
		// columns, that are applicable and has filled some data (path, created, coordinates, etc). When scanning is
		// initiated with stat=false, then only this one item has filled `created` attribute, which in SQL query forces
		// all other items set to null and override already stored `created` value in database.
		// To prevent this override for all other items we remove created from this item, thus SQL insert query will not
		// contain column `created`.
		currentDirectoryItem.created = null;
	}
	items.push(currentDirectoryItem);

	const entriesStream = readdirp(absolutePathToScan, readdirpOptions);
	for await (const entry of entriesStream) {
		if (CONFIG.structure.scan.itemCooldown) { // Wait before processing each item
			await new Promise(resolve => setTimeout(resolve, CONFIG.structure.scan.itemCooldown));
		}

		try {
			const resultItem = await scanOne(entry.fullPath, entry.dirent || entry.stats, scanOneOptions);
			if (resultItem !== null) {
				items.push(resultItem);
			}

			if (items.length > 0 && items.length % 2000 === 0) {
				let humanTime = msToHuman(hrtime(process.hrtime(readDirStartHr)));
				LOG.debug('(ScanStructure) So far scanned ' + items.length + ' items in ' + humanTime + '.')
			}
		} catch (error) {
			LOG.error('(ScanStructure) Scanning throwed error while processing readdirp results: ' + error);
		}
	}
	let humanTime = msToHuman(hrtime(process.hrtime(readDirStartHr)));
	LOG.info('(ScanStructure) Scanning is done, discovered ' + items.length + ' items in ' + humanTime + '.');

	return items;
}

/**
 * Scan one specific item and returns scanned item.
 *
 * @param {string} pathAbsolute
 * @param {FS.Dirent|FS.Stats} entryItem
 * @param {object} options
 *   `stat` (bool) load also file stats (scan will be slower), default false
 *   `exif` (bool) load also EXIF metadata (scan will be slower), default false
 *   `save` (bool) save scanned item into database, default true
 * @return {Promise<FolderItem|FileItem|null>}
 */
async function scanOne(pathAbsolute, entryItem, options) {
	options.exif = (typeof options.exif === 'boolean') ? options.exif : false;
	options.save = (typeof options.save === 'boolean') ? options.save : true;

	// If processed item is symbolic link, load stats for it to get real item (file or directory).
	// isSymbolicLink() is always false if readdirp() option alwaysStat is true
	let realEntryItem = entryItem;
	if (entryItem.isSymbolicLink()) {
		realEntryItem = FS.statSync(pathAbsolute);
	}

	const basename = PATH.basename(pathAbsolute);

	if (realEntryItem.isFile() && basename.match(FileExtensionMapperInstance.regexAll) === null) {
		return null; // file has invalid extension
	}

	const entryPath = pathCustom.absoluteToRelative(pathAbsolute, CONFIG.path);

	let resultItem = null;
	if (realEntryItem.isDirectory()) {
		resultItem = new FolderItem(null, {path: entryPath.replace(/\/+$/, '') + '/'});
	} else if (realEntryItem.isFile()) {
		resultItem = new FileItem(null, {path: entryPath});
		resultItem.size = ['bigint', 'number'].includes(typeof realEntryItem.size) ? realEntryItem.size : null;
		if (options.exif) {
			const exifData = await getCoordsFromExifFromFile(pathAbsolute);
			resultItem = Object.assign(resultItem, exifData);
		}

		if (resultItem.isMap) {
			try {
				if (resultItem.ext === 'geojson') {
					const jsonString = (await FSP.readFile(pathAbsolute)).toString();
					const json = JSON.parse(jsonString);
					resultItem.coords = Utils.geojsonAverageCoordinate(json);
				}
			} catch (error) {
				LOG.warning('Unable to read coordinates from map file item "' + resultItem.path + '" of type map: "' + error.message + '"');
			}
		}

	} else {
		LOG.warning('Unhandled type of file, full path: "' + pathAbsolute + '"');
		return null;
	}
	resultItem.created = realEntryItem.ctime || null;
	resultItem.scanned = new Date();

	if (options.save) {
		await structureRepository.add(resultItem);
	}

	return resultItem;
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
module.exports.scanOne = scanOne;
module.exports.scanning = false;
