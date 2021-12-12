const LOG = require(BASE_DIR_GET('/src/libs/log.js'));
const structureRepository = require('../../../libs/repository/structure');

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
					icon: (new Icon).CLOSE_SEARCHING,
				}],
				files: []
			};
			if (!res.locals.fullPathFolder) {
				throw new Error('no path');
			}

			const searchOptions = {
				searchString: req.query.query,
				lat: req.query.lat,
				lon: req.query.lon,
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
			LOG.error(logPrefix + ' is done in ' + humanTime + ', founded ' + finds.folders.length + ' folders and ' + finds.files.length + ' files.');
			res.result.setError('Error while searching: ' + error.message).end();
		}
	});
};
