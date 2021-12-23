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

		// noinspection ES6MissingAwait (intentionally missing await to send response to user within few seconds)
		scanStructure.scan(res.locals.fullPathFolder, {stat: false, exif: false});

		// Wait a while until scan is finished. If is taking too long, response with default message.
		let responseText = 'Scanning for directory "<b>' + res.locals.queryPath + '</b>" has started.';
		let i = 0;
		const scanCheckInterval = setInterval(function () {
			if (scanStructure.scanning === false) {
				responseText = 'Directory "<b>' + res.locals.queryPath + '</b>" was rescanned.';
			}
			if (i++ > 5 || scanStructure.scanning === false) {
				clearInterval(scanCheckInterval);
				res.result.setResult({scanning: scanStructure.scanning}, responseText).end();
			}
		}, 500);
	});
};
