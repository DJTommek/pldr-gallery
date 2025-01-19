const LOG = require(BASE_DIR_GET('/src/libs/log.js'));
const structureRepository = require('../../../libs/repository/structure');
const utils = require('../../../libs/utils/utils.js');

module.exports = function (webserver, endpoint) {

	/**
	 * Run user search in all files and folders
	 * - case insensitive
	 * - search is performed in folder, what user has loaded (param path)
	 *
	 * @param query - searching string
	 * @param path - where to search
	 */
	webserver.get(endpoint, async function (req, res) {
		try {
			res.statusCode = 200;
			res.setHeader("Content-Type", "application/json");
			let finds = {
				folders: [{ // always show "close searching" button
					path: res.locals.path,
					noFilter: true,
					text: 'Zavřít vyhledávání',
					icon: Icon.CLOSE_SEARCHING,
				}],
				files: [],
				total: null,
			};
			if (!res.locals.fullPathFolder) {
				throw new Error('no path');
			}

			const searchOptions = {
				searchString: req.query.query,
				lat: req.query.lat !== undefined ? req.query.lat : null,
				lon: req.query.lon !== undefined ? req.query.lon : null,
				sizeMin: req.query.sizeMin !== undefined ? utils.clamp(parseInt(req.query.sizeMin)) : null,
				sizeMax: req.query.sizeMax !== undefined ? utils.clamp(parseInt(req.query.sizeMax)) : null,
				sort: parseSortString(req.query.sort || null),
				boundingBox: parseBoundingBox(req.query.boundingBox || null),
			}

			let logPrefix = '(Web) Searching in path "' + res.locals.path + '"';
			res.startTime('apisearching', 'Searching');
			let searchingStart = process.hrtime();

			const limit = req.query.limit !== undefined ? utils.clamp(parseInt(req.query.limit), 1, 2000) : 2000;
			const offset = req.query.offset !== undefined ? utils.clamp(parseInt(req.query.offset)) : 0;

			const searchQuery = structureRepository.search(res.locals.path, searchOptions);
			searchQuery.andWhere(function () {
				for (const permission of res.locals.user.getPermissions()) {
					// 'orWhereLike()' cannot be used due to bug of forcing COLLATE, which slows down the query
					// @link https://github.com/knex/knex/issues/5143 whereLike does not work with the MySQL utf8mb4 character set
					this.orWhere('path', 'LIKE', permission + '%');
				}
			});

			const searchQueryTotal = searchQuery
				.clone()
				.clearSelect()
				.clearOrder()
				.count('id as totalCount')
				.first();

			searchQuery
				.limit(limit)
				.offset(offset);

			const [searchQueryResult, searchQueryTotalResult] = await Promise.all([searchQuery, searchQueryTotal]);
			finds.total = searchQueryTotalResult['totalCount'];

			for (const row of searchQueryResult) {
				if (req.closed) {
					return; // HTTP was already answered, do nothing here (SQL query probably took too long)
				}

				const item = structureRepository.rowToItem(row);

				// @TODO this check should not be necessary, SQL query should already filter out
				if (res.locals.user.testPathPermission(item.path) === false) {
					LOG.warning('Search query is not working correctly: SQL matched "' + item.path + '" which is not valid according backend server check.');
					continue; // filter out items, that user don't have permission on
				}

				item.text = item.path;
				if (item.isFolder) {
					finds.folders.push(item.serialize());
				} else if (item.isFile) {
					finds.files.push(item.serialize());
				}
			}

			res.endTime('apisearching');
			let humanTime = msToHuman(hrtime(process.hrtime(searchingStart)));
			LOG.info(logPrefix + ' is done in ' + humanTime + ', founded ' + finds.folders.length + ' folders and ' + finds.files.length + ' files.');
			res.result.setResult(finds, 'Loaded ' + searchQueryResult.length + ' item(s) out of ' + finds.total + ' available.').end();
		} catch (error) {
			LOG.error('Error while searching: ' + error.message);
			res.result.setError('Error while searching, try again later.').end();
		}
	});
};

function parseSortString(input) {
	if (input === null) {
		return null;
	}

	// sorting only based on column name (distance, size, ...)
	const columnMatch = input.match(/^([a-z-]+)$/i);
	if (columnMatch !== null) {
		return {
			column: input.toLowerCase().trim(),
			order: 'asc',
		};
	}

	// sorting based on column name (distance, size, ...) and order (asc or desc)
	const columnOrderMatch = input.match(/^([a-z-]+)( (?:asc|desc))$/i);
	if (columnOrderMatch !== null) {
		return {
			column: columnOrderMatch[1].toLowerCase().trim(),
			order: columnOrderMatch[2].toLowerCase().trim()
		};
	}

	return null;
}

/**
 * Convert bounding box into set of two coordinates placed in the two opposite corners.
 * Expected format of bounding box is to send 4 numbers with `,` (comma) as delimiter in this order:
 * - west-most longitude
 * - south-most latitude
 * - east-most longitude
 * - north-most latitude
 *
 * @param {?string} input
 * @return {array<Coordinates>|null} Array of two coordinates if bounding box input is valid, null otherwise.
 */
function parseBoundingBox(input) {
	if (input === null) {
		return null;
	}

	const bordersRaw = input.split(',');
	if (bordersRaw.length !== 4) {
		return null;
	}

	try {
		const southWest = new Coordinates(bordersRaw[1], bordersRaw[0]);
		const northHeast = new Coordinates(bordersRaw[3], bordersRaw[2]);
		return [southWest, northHeast];
	} catch (error) {
		return null; // Invalid coordinates
	}
}
