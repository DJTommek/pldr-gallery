const CONFIG = require(BASE_DIR_GET('/src/libs/config.js'));
const scanStructure = require(BASE_DIR_GET('/src/libs/scanStructure.js'));

module.exports = function (webserver, endpoint) {

	/**
	 * Rescan some directory to database
	 *
	 * @returns JSON
	 */
	webserver.get(endpoint, async function (req, res) {
		res.statusCode = 200;
		res.setHeader("Content-Type", "application/json");
		if (!CONFIG.structure.scan.enable) {
			res.result.setError('Scanning is disabled.').end();
			return;
		}

		if (!res.locals.fullPathFolder) {
			res.result.setError('Zadaná cesta "<b>' + res.locals.queryPath + '</b>" není platná nebo na ni nemáš právo.').end();
			return;
		}

		if (scanStructure.scanning) {
			res.result.setError('Scanning is still running... Try again later.').end();
			return;
		}

		res.result.setResult({}, 'Scanning for directory "<b>' + res.locals.queryPath + '</b>" has started.').end();
		await scanStructure.scan(res.locals.fullPathFolder, {stat: false, exif: false});
	});
};
