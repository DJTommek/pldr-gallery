const CONFIG = require(BASE_DIR_GET('/src/libs/config.js'));
const scanStructure = require(BASE_DIR_GET('/src/libs/scanStructure.js'));

module.exports = function (webserver, endpoint) {

	/**
	 * Rescan some directory to database
	 *
	 * @returns JSON
	 */
	webserver.get(endpoint, async function (req, res) {
		if (!CONFIG.structure.scan.enable) {
			return res.result.setError('Scanning is disabled.').end(403);
		}

		/** @var {FolderItem|null} */
		const folderItem = res.locals.pathItem;
		if (folderItem?.isFolder !== true) {
			return res.result.setError('Invalid path or you dont have a permission.').end(403);
		}

		if (scanStructure.scanning) {
			res.result.setError('Scanning is still running... Try again later.').end();
			return;
		}

		// To run scan user must have full access to the directory
		if (res.locals.user.testPathPermission(folderItem.path, true) === false) {
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
		scanStructure.scan(res.locals.pathAbsolute, scanOptions);

		// Wait a while until scan is finished. If is taking too long, response with default message.
		const responseTextDefault = scanType + ' scan of directory "' + folderItem.path + '"';
		let responseText = responseTextDefault + ' has started.';
		let i = 0;
		const scanCheckInterval = setInterval(function () {
			if (scanStructure.scanning === false) {
				responseText = responseTextDefault + ' has been finished.';
			}
			if (i++ > 5 || scanStructure.scanning === false) {
				clearInterval(scanCheckInterval);
				res.result.setResult({scanning: scanStructure.scanning}, responseText).end(200);
			}
		}, 500);
	});
};
