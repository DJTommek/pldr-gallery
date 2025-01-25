const CONFIG = require('../config.js');
const LOG = require('../log.js');
const knex = require('../database.js');
const pathCustom = require("../path.js");
require(BASE_DIR_GET('/src/webserver/private/js/class/Coordinates.js'));

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
	LOG.debug('(Knex) Running SQL: ' + query.toString());
	try {
		(await query).forEach(function (row) {
			result.push(rowToItem(row));
		});
	} catch (error) {
		LOG.error('[Knex] Error while loading and processing in "' + folderPath + '": ' + error.message);
	}
	LOG.debug('(Knex) Loading structure took ' + msToHuman(hrtime(process.hrtime(hrstart))) + '.', {console: true})
	return result;
}

module.exports.loadByPath = loadByPath;

/**
 * Get random files from specified directory or any below
 *
 * @param {string} folderPath
 * @returns {Promise<array[FileItem]>}
 */
async function randomFiles(folderPath, options = {}) {
	options.limit = (typeof options.limit === 'number') ? options.limit : 2000;
	options.onlyImages = (typeof options.onlyImages === 'boolean') ? options.onlyImages : false;

	const hrstart = process.hrtime();
	const result = [];

	const folderItem = new FolderItem(null, {path: folderPath});
	const searchingLevel = folderItem.paths.length + 1;
	const query = knex.select('*')
		.from(CONFIG.db.table.structure)
		.andWhere('type', TYPE_FILE)
		.andWhere('level', '>=', searchingLevel)
		.andWhere('path', 'LIKE', folderPath + '%')
		.orderByRaw('RAND()')
		.limit(options.limit);

	if (options.onlyImages) {
		query.andWhere(function () {
			this.orWhereRaw('LOWER(path) LIKE ?', '%.jpg')
			this.orWhereRaw('LOWER(path) LIKE ?', '%.jpeg')
			this.orWhereRaw('LOWER(path) LIKE ?', '%.png')
		});
	}

	LOG.debug('(Knex) Running SQL: ' + query.toString());
	try {
		return query.map(row => rowToItem(row));
	} catch (error) {
		LOG.error('[Knex] Error while loading and processing random files in "' + folderPath + '": ' + error.message);
	} finally {
		LOG.debug('(Knex) Loading random files took ' + msToHuman(hrtime(process.hrtime(hrstart))) + '.', {console: true})
	}
}

module.exports.randomFiles = randomFiles;

/**
 * Get random files from specified directory or any below.
 *
 * Works by downloading all IDs from database that matches criteria, pick random x IDs and run new query, that will
 * select only specific IDs. Order by RAND() would more friendly to local memory and bandwidth, but it is much slower.
 *
 * @param {string} folderPath
 * @param options
 * @returns {Promise<array[FileItem]>}
 */
async function randomFiles2(folderPath, options = {}) {
	options.onlyImages = (typeof options.onlyImages === 'boolean') ? options.onlyImages : false;
	options.count = (typeof options.count === 'number') ? options.count : 20;

	const hrstart = process.hrtime();

	const folderItem = new FolderItem(null, {path: folderPath});
	const searchingLevel = folderItem.paths.length + 1;
	const query = knex.select('id')
			.from(CONFIG.db.table.structure)
			.andWhere('type', TYPE_FILE)
			.andWhere('level', '>=', searchingLevel)
			.andWhere('path', 'LIKE', folderPath + '%');
	// Limit is intentionally missing because it is slowing query down, search for "row lookups"
	// @link https://stackoverflow.com/a/40927536/3334403

	if (options.onlyImages) {
		query.andWhere(function () {
			this.orWhereRaw('LOWER(path) LIKE ?', '%.jpg')
			this.orWhereRaw('LOWER(path) LIKE ?', '%.jpeg')
			this.orWhereRaw('LOWER(path) LIKE ?', '%.png')
		});
	}

	LOG.debug('(Knex) Running SQL: ' + query.toString());
	const rowsIds = await query;
	LOG.debug('(Knex) Loading random IDs took ' + msToHuman(hrtime(process.hrtime(hrstart))) + '.', {console: true})

	const randomIds = [];
	while(rowsIds.length > 0) {
		const randomIdRow = rowsIds.splice(Math.floor(Math.random() * rowsIds.length), 1);
		randomIds.push(randomIdRow[0].id);
		if (randomIds.length === options.count) {
			break;
		}
	}

	if (randomIds.length !== options.count) {
		return [];
	}

	const rows2 = await knex
		.select('*')
		.from(CONFIG.db.table.structure)
		.whereIn('id', randomIds);

	return rows2.map(row => rowToItem(row));
}

module.exports.randomFiles2 = randomFiles2;

/**
 * @param {string} folderPath
 * @param {object} options
 * @return {Knex.QueryBuilder<TRecord, TResult>}
 */
function search(folderPath, options = {}) {
	const hrstart = process.hrtime();
	const result = [];

	const folderItem = new FolderItem(null, {path: folderPath});
	const searchingLevel = folderItem.paths.length + 1;

	const columnsToSelect = ['*'];
	let columnsToOrder = ['level', 'path'];

	const query = knex
		.from(CONFIG.db.table.structure)
		.where('level', '>=', searchingLevel)
		.where('path', 'LIKE', folderPath + '%')
	if (options) {
		switch (options?.sort?.column) {
			case 'distance':
				if (options.coordinates === null) {
					break;
				}
				// Measure distance to given lat/lon
				columnsToSelect.push(knex.raw(
					'st_distance_sphere(POINT(?, ?), coordinates) AS distance',
					[options.coordinates.lon, options.coordinates.lat]
				));
				query.whereNotNull('coordinates');
				columnsToOrder.unshift(options.sort);
				break;
			case 'name':
				columnsToOrder.unshift({column: 'path', order: options.sort.order});
				break;
			case 'created':
				columnsToOrder.unshift(options.sort);
				break;
			case 'size':
				query.where('type', TYPE_FILE);
				columnsToOrder.unshift(options.sort);
				break;
			default:
				// default sort
				break;
		}

		if (options.boundingBox) {
			query.whereNotNull('coordinates');
			query.whereRaw(
				'MBRContains(GeomFromText(\'LINESTRING(? ?,? ?)\'), coordinates)',
				[
					options.boundingBox[0].lon,
					options.boundingBox[0].lat,
					options.boundingBox[1].lon,
					options.boundingBox[1].lat,
				]
			);
		}

		if (options.type) {
			query.where('type', options.type);
		}

		if (options.searchString !== undefined) {
			if (typeof options.searchString !== 'string' || options.searchString === '') {
				throw new Error('Option "searchString" must be non-empty string');
			}
			// The \% and \_ sequences are used to search for literal instances of % and _ in pattern-matching contexts
			// where they would otherwise be interpreted as wildcard characters.
			// @see https://dev.mysql.com/doc/refman/8.0/en/string-literals.html
			// In Javascript it needs to be double backslash, because one escapes the another
			const searchStringEscaped = options.searchString.replaceAll('%', '\\%').replaceAll('_', '\\_');
			query.where('path', 'LIKE', '%' + searchStringEscaped + '%')
			// @TODO search only in basename?
			// query.andWhere('basename', 'LIKE', '%' + searchStringEscaped + '%')
		}

		if (options.sizeMin > 0 && options.sizeMax) {
			query.whereBetween('size', [options.sizeMin, options.sizeMax]);
		} else if (options.sizeMin) { // intentionally non-strict checking (higher than zero)
			query.where('size', '>=', options.sizeMin);
		} else if (options.sizeMax) { // intentionally non-strict checking (higher than zero)
			query.where('size', '<=', options.sizeMax);
		}
	}

	columnsToOrder.unshift('type');

	query.select(columnsToSelect);
	query.orderBy(columnsToOrder);

	return query;
}

module.exports.search = search;

class PercentileSize {
	constructor(percent, fileSize) {
		this.percent = percent;
		this.fileSize = fileSize;
	}
}

/**
 * Calculate percentiles for column size.
 *
 * @param {number[]} percentiles Array of numbers between 0 and 1 inclusive, to which size percentile will be calculated.
 * @example sizePercentiles([0, 0.5, 1]) will return smallest file size, median and biggest file size
 * @returns {null|PercentileSize[]} Order of objects in array will be same as input. Null if no files with size available
 */
async function sizePercentiles(percentiles) {
	let selectRaw = ' DISTINCT `type` ';
	let selectRawParams = [];
	let key = 0;
	for (const percent of percentiles) {
		if (typeof percent !== 'number' || percent < 0 || percent > 1) {
			throw new Error('Percentiles must be array of numbers between 0 and 1 inclusive.');
		}

		// Generate percentile_cont() query (@author https://stackoverflow.com/a/59930201/3334403)
		if (percent === 0) {
			selectRaw += ' , (' + knex.min('size').from(CONFIG.db.table.structure) + ') as percentile_' + key + ' ';
		} else if (percent === 1) {
			selectRaw += ' , (' + knex.max('size').from(CONFIG.db.table.structure) + ') as percentile_' + key + ' ';
		} else {
			selectRaw += ', percentile_cont(?) within group (order by `size`) over (partition by `type`) as percentile_' + key + ' ';
			selectRawParams.push(percent);
		}
		key++;
	}

	const queryResult = await knex.select(knex.raw(selectRaw, selectRawParams))
		.from(CONFIG.db.table.structure)
		.where('type', TYPE_FILE)
		.whereNotNull('size').first();

	if (queryResult === undefined) {
		// Probably there are no files with filled size
		return null;
	} else {
		const result = [];
		key = 0;
		for (const percent of percentiles) {
			result.push(new PercentileSize(percent, queryResult['percentile_' + key]));
			key++;
		}
		return result;
	}
}

module.exports.sizePercentiles = sizePercentiles;

/**
 * Load specific row.
 *
 * @param {string} relativePath
 * @returns {null|FileItem|FolderItem}
 */
async function getByPath(relativePath) {
	const query = knex.select('*')
		.from(CONFIG.db.table.structure)
		.where('path', relativePath)
		.limit(1);
	const rows = await query;
	if (rows.length === 0) {
		return null;
	} else {
		return rowToItem(rows[0]);
	}
}

module.exports.getByPath = getByPath;

/**
 * Get all rows from database as iterator.
 *
 * @TODO improve to return stream of FileItem and FolderItem objects instead of raw rows.
 */
function all() {
	return knex.select('*')
		.from(CONFIG.db.table.structure);
}

module.exports.all = all;

/**
 * @param {string} absoluteFolderPath Path, that was scanned
 * @param {array<FileItem|FolderItem>} newData
 * @param {Date} scanStart Older items than this time will be deleted
 */
async function updateData(absoluteFolderPath, newData, scanStart) {
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
		if (item.coords) {
			row.coordinate_lat = item.coords.lat;
			row.coordinate_lon = item.coords.lon;
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

			const relativePath = pathCustom.absoluteToRelative(absoluteFolderPath, CONFIG.path);
			const folderItem = new FolderItem(null, {path: relativePath});
			const searchingLevel = folderItem.paths.length + 1;
			const deleted = await transaction(CONFIG.db.table.structure)
				.delete()
				.where('scanned', '<', scanStart.getTime())
				.andWhere('level', '>=', searchingLevel)
				.andWhere('path', 'LIKE', relativePath + '%')

			LOG.info('(ScanStructure) Scanned structure in database was updated (' + deleted + ' deleted).');
		});
	} catch (error) {
		LOG.error('Error while inserting scanned structure to database: ' + error.message);
	}
}

module.exports.updateData = updateData;

/**
 * @param {FileItem|FolderItem} item
 */
async function add(item) {
	const row = {
		path: item.path,
		type: getItemType(item),
		scanned: item.scanned.getTime(),
	};
	if (item.created !== null) {
		row.created = item.created.getTime();
	}
	if (item.size !== null) {
		row.size = item.size;
	}
	if (item.coords) {
		row.coordinate_lat = item.coords.lat;
		row.coordinate_lon = item.coords.lon;
	}

	try {
		await knex(CONFIG.db.table.structure).insert(row).onConflict('path').merge();
	} catch (error) {
		LOG.error('Error while inserting item structure to database: ' + error.message);
	}
}

module.exports.add = add;

/**
 * @param {FileItem|FolderItem|string} item
 */
async function remove(item) {
	let pathToRemove = null;
	if (item instanceof Item) {
		pathToRemove = item.path;
	} else if (typeof item === 'string') {
		pathToRemove = item;
	} else {
		throw new Error('Invalid input for structure.remove: expected Item or string (path).');
	}

	try {
		await knex(CONFIG.db.table.structure).delete().where({path: pathToRemove});
	} catch (error) {
		LOG.error('Error while removing path "' + pathToRemove + '" from structure database: ' + error.message);
	}
}

module.exports.remove = remove;

/**
 * @param {array<FileItem|FolderItem>} item
 */
function getItemType(item) {
	if (item instanceof FileItem) {
		return TYPE_FILE;
	} else if (item instanceof FolderItem) {
		return TYPE_FOLDER;
	}
}

/**
 * Convert row to item depending on type.
 *
 * @param {RowDataPacket} row
 * @returns {FileItem|FolderItem}
 */
function rowToItem(row) {
	let item = null;
	if (row.type === TYPE_FILE) {
		item = new FileItem(null, {
			path: row.path,
			size: row.size,
			coords: Coordinates.safe(row.coordinate_lat, row.coordinate_lon),
			distance: row.distance,
		});
	} else if (row.type === TYPE_FOLDER) {
		item = new FolderItem(null, {
			path: row.path,
		});
	} else {
		throw new Error('Unexpected item type "' + row.type + '".');
	}
	if (row.created !== null) {
		item.created = new Date(row.created);
	}
	item.scanned = new Date(row.scanned);
	return item;
}

module.exports.rowToItem = rowToItem;
