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

function load(path, options) {
	if (options === undefined) {
		options = {}
	}
	options.exif = (typeof options.exif === 'boolean') || true;
	options.debug = (typeof options.debug === 'boolean') || false;

	let finds = {
		folders: [],
		files: []
	};
	LOG.info('(ScanStructure) Scanning started.');
	const readDirStartHr = process.hrtime();
	const readDirStart = new Date();

	readdirp(path, {
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

			let entryPath = pathCustom.absoluteToRelative(entry.fullPath, CONFIG.path);

			let pathData = {
				path: entryPath,
				text: entryPath,
				scanned: new Date(),
			};
			if (item.isDirectory()) {
				pathData.path += '/';
				pathData.text += '/';
				finds.folders.push(pathData);
			} else { // is file, load detailed info
				let pathStats = FS.lstatSync(entry.fullPath);
				pathData.size = pathStats.size;
				pathData.created = pathStats.ctime;
				pathData = Object.assign(pathData, getCoordsFromExifFromFile(entry.fullPath));
				finds.files.push(pathData);
			}

			if (options.debug === true && finds.files.length > 0 && finds.files.length % 1000 === 0) {
				let humanTime = msToHuman(hrtime(process.hrtime(readDirStartHr)));
				LOG.debug('(ScanStructure) So far scanned ' + finds.files.length + ' files and ' + finds.folders.length + ' folders in ' + humanTime + '.')
			}
		} catch (error) {
			LOG.error('(ScanStructure) Scanning throwed error while processing readdirp results: ' + error);
		}
	}).on('warn', function (warning) {
		LOG.warning('(ScanStructure) Scanning throwed warning: ' + warning);
	}).on('error', function (error) {
		LOG.error('(ScanStructure) Scanning throwed error: ' + error);
	}).on('end', async function () {
		let humanTime = msToHuman(hrtime(process.hrtime(readDirStartHr)));
		LOG.info('(ScanStructure) Scanning is done in ' + humanTime + ', founded ' + finds.folders.length + ' folders and ' + finds.files.length + ' files.');
		await updateDatabase(finds, readDirStart);
		console.log(finds.folders.length);
		console.log(finds.files.length);

	});
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
		return {
			path: pathData.path,
			type: 0,
			scanned: pathData.scanned.getTime(),
		};
	});
	const findsFiles = finds.files.map(function (pathData) {
		const result = {
			path: pathData.path,
			type: 1,
			scanned: pathData.scanned.getTime(),
		};
		if (typeof pathData.coordLat === 'number' && typeof pathData.coordLon === 'number') {
			result.coordinate_lat = pathData.coordLat;
			result.coordinate_lon = pathData.coordLon;
		}
		return result;
	});
	try {
		const BATCH_SIZE = 100;
		await knex.transaction(async function (transaction) {
			const chunk = [];
			let chunkCount = 0;
			for (const row of findsFiles.concat(findsFolders)) {
				chunk.push(row);
				if (chunk.length === BATCH_SIZE) {
					LOG.debug('Inserting batch #' + chunkCount++ + ' to database, ' + Math.max(findsFiles.length - (BATCH_SIZE * chunkCount), 0) + ' rows remaining.')
					await transaction(CONFIG.db.table.structure).insert(chunk).onConflict('path').merge();
					chunk.length = 0;
				}
			}
			const deleted = await transaction(CONFIG.db.table.structure).delete().where('scanned', '<', scanStart.getTime());
			LOG.info('(ScanStructure) Scanned structure in database was updated (' + deleted + ' deleted).');
		});
	} catch (error) {
		LOG.error('Error while inserting scanned structure to database: ' + error.message);
	}
}

module.exports.scan = scan;
