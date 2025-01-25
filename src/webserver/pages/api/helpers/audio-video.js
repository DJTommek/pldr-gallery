const LOG = require(BASE_DIR_GET('/src/libs/log.js'));
const FS = require('fs');

module.exports = function (webserver, endpointPath) {
	/**
	 * Stream video or audio into browser
	 *
	 * @author https://medium.com/better-programming/video-stream-with-node-js-and-html5-320b3191a6b6
	 * @returns video/audio stream
	 */
	webserver.get(endpointPath, function (req, res) {
		res.statusCode = 200;

		/** @var {FileItem|null} */
		const fileItem = res.locals.pathItem;
		if (fileItem?.isFile !== true) {
			return res.result.setError('Invalid path or you dont have a permission.').end(403);
		}

		try {
			const mimeType = fileItem.mimeType;
			if (!mimeType) {
				return res.result.setError('MIME type of file "' + fileItem.path + '" is not supported for the stream.').end(400);
			}

			if (
				(fileItem.isVideo && req.path === '/api/video')
				|| (fileItem.isAudio && req.path === '/api/audio')
			) {
				// Combination is ok
			} else {
				return res.result.setError('File "' + fileItem.path + '" is not supported for the stream.').end(400);
			}

			const fileSize = FS.statSync(res.locals.fullPathFile).size;
			const range = req.headers.range;
			const dispositionHeader = 'inline; filename="' + encodeURI(fileItem.basename) + '"';
			if (range) {
				const parts = range.replace(/bytes=/, '').split('-');
				const start = parseInt(parts[0], 10);
				const end = (parts[1] ? parseInt(parts[1], 10) : fileSize - 1);
				const file = FS.createReadStream(res.locals.fullPathFile, {start, end});
				res.writeHead(206, {
					'Content-Range': `bytes ${start}-${end}/${fileSize}`,
					'Accept-Ranges': 'bytes',
					'Content-Length': (end - start) + 1, // chunk size
					'Content-Type': mimeType,
					'Content-Disposition': dispositionHeader,
				});
				file.pipe(res);
			} else {
				res.writeHead(200, {
					'Content-Length': fileSize,
					'Content-Type': mimeType,
					'Content-Disposition': dispositionHeader,
				});
				FS.createReadStream(res.locals.fullPathFile).pipe(res);
			}
		} catch (error) {
			LOG.error('Error while streaming file "' + fileItem + '": "' + error.message + '"');
			res.result.setError('Error while streaming file "' + fileItem.path + '", try again later.').end(500);
		}
	});
};
