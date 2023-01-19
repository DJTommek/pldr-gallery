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
				files: []
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
			}

			let logPrefix = '(Web) Searching in path "' + res.locals.path + '"';
			res.startTime('apisearching', 'Searching');
			let searchingStart = process.hrtime();

			(await structureRepository.search(res.locals.path, searchOptions)).forEach(function (item) {
				if (finds.folders.length < 1000 && finds.files.length < 1000) {
					if (res.locals.user.testPathPermission(item.path) === false) {
						return;	// filter out items, that user don't have permission on
					}
					item.text = item.path;
					if (item.isFolder) {
						finds.folders.push(item.serialize());
					} else if (item.isFile) {
						finds.files.push(item.serialize());
					}
				}
			})
			res.endTime('apisearching');
			let humanTime = msToHuman(hrtime(process.hrtime(searchingStart)));
			LOG.info(logPrefix + ' is done in ' + humanTime + ', founded ' + finds.folders.length + ' folders and ' + finds.files.length + ' files.');
			res.result.setResult(finds, 'Done in ' + humanTime).end();
		} catch (error) {
			LOG.error('Error while searching: ' + error.message);
			res.result.setError('Error while searching: ' + error.message).end();
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
