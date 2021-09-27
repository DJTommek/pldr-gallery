const CONFIG = require('./config.js');
const LOG = require('./log.js');
const FS = require('fs');
const pathCustom = require('./path.js');
const PATH = require('path');
const readline = require('readline');
const exifParser = require('exif-parser');
const readdirp = require('readdirp');
const HFS = require(BASE_DIR_GET('/src/libs/helperFileSystem.js'));
const knex = require('./database.js');

async function scan(path, options = {}) {
	options.exif = (typeof options.exif === 'boolean') ? options.exif : false;
	options.stat = (typeof options.stat === 'boolean') ? options.stat : false;
	if (module.exports.scanning) {
		LOG.warning('Scanning is already in progress, try again later.');
		return;
	}
	module.exports.scanning = true;
	let finds = {
		folders: [],
		files: []
	};
	LOG.info('(ScanStructure) Scanning started for path "' + path + '" (options: ' + JSON.stringify(options) + ').');
	const readDirStartHr = process.hrtime();
	const readDirStart = new Date();

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
			const item = entry.dirent || entry.stats;

			// If processed item is symbolic link, load stats for it to get real item (file or directory).
			// isSymbolicLink() is always false if readdirp() option alwaysStat is true
			let realItem = item;
			if (item.isSymbolicLink()) {
				realItem = FS.statSync(entry.fullPath);
			}

			if (realItem.isFile() && entry.basename.match((new FileExtensionMapper).regexAll) === null) {
				continue; // file has invalid extension
			}

			let entryPath = pathCustom.absoluteToRelative(entry.fullPath, CONFIG.path);

			let pathData = {
				path: entryPath,
				text: entryPath,
				created: realItem.ctimeMs || null,
				scanned: new Date(),
			};

			if (realItem.isDirectory()) {
				pathData.path += '/';
				pathData.text += '/';
				finds.folders.push(pathData);
			} else if (realItem.isFile()) {
				pathData.size = realItem.size || null;
				if (options.exif) {
					pathData = Object.assign(pathData, getCoordsFromExifFromFile(entry.fullPath));
				}
				finds.files.push(pathData);
			} else {
				LOG.warning('Unhandled type of file, full path: "' + entry.fullPath + '"');
				continue;
			}

			if (finds.files.length > 0 && finds.files.length % 1000 === 0) {
				let humanTime = msToHuman(hrtime(process.hrtime(readDirStartHr)));
				LOG.debug('(ScanStructure) So far scanned ' + finds.files.length + ' files and ' + finds.folders.length + ' folders in ' + humanTime + '.')
			}
		} catch (error) {
			LOG.error('(ScanStructure) Scanning throwed error while processing readdirp results: ' + error);
		}
	}
	let humanTime = msToHuman(hrtime(process.hrtime(readDirStartHr)));
	LOG.info('(ScanStructure) Scanning is done in ' + humanTime + ', founded ' + finds.folders.length + ' folders and ' + finds.files.length + ' files.');
	await updateDatabase(finds, readDirStart);
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

/**
 * @param finds
 * @param {Date} scanStart
 */
async function updateDatabase(finds, scanStart) {
	const findsFolders = finds.folders.map(function (pathData) {
		const result = {
			path: pathData.path,
			type: 0,
			scanned: pathData.scanned.getTime(),
		};
		if (pathData.created) {
			result.created = pathData.created;
		}
		return result;
	});
	const findsFiles = finds.files.map(function (pathData) {
		const result = {
			path: pathData.path,
			type: 1,
			scanned: pathData.scanned.getTime(),
		};
		if (pathData.size) {
			result.size = pathData.size;
		}
		if (pathData.created) {
			result.created = pathData.created;
		}
		if (typeof pathData.coordLat === 'number' && typeof pathData.coordLon === 'number') {
			result.coordinate_lat = pathData.coordLat;
			result.coordinate_lon = pathData.coordLon;
		}
		return result;
	});
	try {
		const BATCH_SIZE = 10000;
		await knex.transaction(async function (transaction) {
			const chunk = [];
			let chunkCount = 0;
			const allItems = findsFiles.concat(findsFolders);
			LOG.debug('Loaded ' + allItems.length + ' items total, updating database...')
			for (const row of allItems) {
				chunk.push(row);
				if (chunk.length === BATCH_SIZE) {
					LOG.debug('Inserting batch #' + (chunkCount++) + ' to database, ' + (allItems.length - (BATCH_SIZE * chunkCount)) + ' rows remaining.')
					await transaction(CONFIG.db.table.structure).insert(chunk).onConflict('path').merge();
					chunk.length = 0;
				}
			}
			if (chunk.length > 0) {
				LOG.debug('Inserting final batch #' + (chunkCount++) + ' of ' + chunk.length + ' rows to database, no rows remaining.')
				await transaction(CONFIG.db.table.structure).insert(chunk).onConflict('path').merge();
			}
			const deleted = await transaction(CONFIG.db.table.structure).delete().where('scanned', '<', scanStart.getTime());
			LOG.info('(ScanStructure) Scanned structure in database was updated (' + deleted + ' deleted).');
		});
	} catch (error) {
		LOG.error('Error while inserting scanned structure to database: ' + error.message);
	}
}

module.exports.scan = scan;
module.exports.scanning = false;
