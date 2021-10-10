const CONFIG = require('../config.js');
const LOG = require('../log.js');
const knex = require('../database.js');

const TYPE_FILE = 1;
const TYPE_FOLDER = 0;

module.exports.TYPE_FILE = TYPE_FILE;
module.exports.TYPE_FOLDER = TYPE_FOLDER;

/**
 *
 * @param folderPath
 * @param options
 * @returns {Promise<array[FileItem|FolderItem]>}
 */
async function loadByPath(folderPath, options = {}) {
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

	const result = [];

	const folderItem = new FolderItem(null, {path: folderPath});
	const searchingLevel = folderItem.paths.length + 1;
	const query = knex.select('*')
		.from(CONFIG.db.table.structure)
	if (options.recursive) {
		query.andWhere('level', '>=', searchingLevel)
	} else {
		query.andWhere('level', searchingLevel)
	}
	query.andWhere('path', 'LIKE', folderPath + '%')
	query.orderBy(['level', 'path']);
	console.log(query.toString());
	try {
		(await query).forEach(function (row) {
			const itemCreated = row.created === null ? null : new Date(row.created);
			if (row.type === TYPE_FILE) {
				result.push(new FileItem(null, {
					path: row.path,
					size: row.size,
					created: itemCreated,
					coordinate_lat: row.coordinate_lat,
					coordinate_lon: row.coordinate_lon,
				}));
			} else if (row.type === TYPE_FOLDER) {
				result.push(new FolderItem(null, {
					path: row.path,
					created: itemCreated,
				}));
			}
		});
	} catch (error) {
		LOG.error('[Knex] Error while loading and processing in "' + fullPath + '": ' + error.message);
	}
	LOG.debug('(Knex) Loading structure took ' + msToHuman(hrtime(process.hrtime(hrstart))) + '.', {console: true})
	return result;
}

module.exports.loadByPath = loadByPath;


/**
 * @param {array<FileItem|FolderItem>} newData
 * @param {Date} scanStart Older items than this time will be deleted
 */
async function updateData(newData, scanStart) {
	const rows = newData.map(function (item) {
		const row = {
			path: item.path,
			type: getItemType(item),
			scanned: item.scanned.getTime(),
		};
		if (item.created !== null) {
			row.created = item.created;
		}
		if (item.size !== null) {
			row.size = item.size;
		}
		if (typeof item.coordLat === 'number' && typeof item.coordLon === 'number') {
			row.coordinate_lat = item.coordLat;
			row.coordinate_lon = item.coordLon;
		}
		return row;
	});

	try {
		const BATCH_SIZE = 10000;
		await knex.transaction(async function (transaction) {
			const chunk = [];
			let chunkCount = 0;
			LOG.debug('Loaded ' + rows.length + ' items total, updating database...')
			for (const row of rows) {
				chunk.push(row);
				if (chunk.length === BATCH_SIZE) {
					LOG.debug('Inserting batch #' + (chunkCount++) + ' (' + chunk.length + ' rows) to database, ' + (rows.length - (BATCH_SIZE * chunkCount)) + ' rows remaining.')
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

module.exports.updateData = updateData;

/**
 * @param {array<FileItem|FolderItem>} item
 */
function getItemType(item) {
	if (item instanceof FileItem) {
		return TYPE_FILE;
	} else if (item instanceof FileItem) {
		return TYPE_FOLDER;
	}
}
