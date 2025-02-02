const FS = require('fs');
const LOG = require(BASE_DIR_GET('/src/libs/log.js'));
const HFS = require(BASE_DIR_GET('/src/libs/helperFileSystem.js'));
module.exports = function (webserver, endpoint) {

	/**
	 * Force download file instead custom headers for image, video etc.
	 *
	 * @returns streamed file if ok
	 * @returns JSON if error
	 */
	webserver.get(endpoint, function (req, res) {
		res.statusCode = 200;

		/** @var {FileItem|null} */
		const fileItem = res.locals.pathItem;
		if (fileItem?.isFile !== true) {
			return res.result.setError('Invalid path or you dont have a permission.').end(403);
		}

		try {
			const mimeType = fileItem.mimeType;
			if (mimeType) {
				res.setHeader('Content-Type', mimeType);
			}

			res.setHeader('Content-Disposition', 'attachment; filename="' + encodeURI(fileItem.basename) + '"');
			LOG.info('(Web) Streaming file to download: ' + res.locals.fullPathFile);
			return FS.createReadStream(res.locals.fullPathFile).pipe(res);
		} catch (error) {
			LOG.error('Error while downloading file: "' + error.message + '"');
			res.result.setError('Error while downloading file "' + fileItem.path + '", try again later.').end(500);
		}
	});
};
