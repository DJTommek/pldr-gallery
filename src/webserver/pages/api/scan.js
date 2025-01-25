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

		if (res.locals.user.testPathPermission(res.locals.pathItemSimple, true) === false) {
			return res.result.setError('You dont have enough permissions.').end(403);
		}

		const scanOptions = {stat: false, exif: false};
		let scanType = 'Fast';
		if (req.query.deep === '1') {
			scanType = 'Deep';
			scanOptions.stat = true;
			scanOptions.exif = true;
		}

		// noinspection ES6MissingAwait (intentionally missing await to send response to user within few seconds)
		scanStructure.scan(res.locals.fullPathFolder, scanOptions);

		// Wait a while until scan is finished. If is taking too long, response with default message.
		const responseTextDefault = '<b>' + scanType + '</b> scan of directory "<b>' + res.locals.queryPath + '</b>" ';
		let responseText = responseTextDefault + ' has started.';
		let i = 0;
		const scanCheckInterval = setInterval(function () {
			if (scanStructure.scanning === false) {
				responseText = responseTextDefault + ' has been finished.';
			}
			if (i++ > 5 || scanStructure.scanning === false) {
				clearInterval(scanCheckInterval);
				res.result.setResult({scanning: scanStructure.scanning}, responseText).end();
			}
		}, 500);
	});
};
