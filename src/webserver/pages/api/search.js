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
		res.statusCode = 200;
		res.setHeader("Content-Type", "application/json");
		let finds = {
			folders: [{ // always show "close searching" button
				path: res.locals.path,
				noFilter: true,
				text: 'Zavřít vyhledávání "' + req.query.query + '"',
				icon: (new Icon).CLOSE_SEARCHING,
			}],
			files: []
		};
		try {
			if (!req.query.query) {
				throw new Error('no search query');
			}
			if (!res.locals.fullPathFolder) {
				throw new Error('no path');
			}
		} catch (error) {
			res.result.setError('Error while searching: ' + error.message).end();
			return;
		}

		let logPrefix = '(Web) Searching "' + req.query.query + '" in path "' + res.locals.path + '"';
		let readDirStart = process.hrtime();

		res.startTime('apisearching', 'Searching');
		(await structureRepository.search(res.locals.path, req.query.query)).forEach(function (item) {
			if (finds.folders.length < 1000 || finds.folders.length < 1000) {
				if(res.locals.user.testPathPermission(item.path) === false) {
					return;	// filter out items, that user don't have permission on
				}
				item.text = item.path;
				if (item.isFolder) {
					finds.folders.push(item.serialize());
				} else if (item.isFile) {
					finds.files.push(item.serialize());
				}
			}
		});
		res.endTime('apisearching');
		let humanTime = msToHuman(hrtime(process.hrtime(readDirStart)));
		LOG.info(logPrefix + ' is done in ' + humanTime + ', founded ' + finds.folders.length + ' folders and ' + finds.files.length + ' files.');
		res.result.setResult(finds, 'Done in ' + humanTime).end();
	});
};
