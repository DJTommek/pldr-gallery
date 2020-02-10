const c = require(process.cwd() + '/libs/config.js');
const FS = require('fs');
const HFS = require(process.cwd() + '/libs/helperFileSystem.js');
const LOG = require(process.cwd() + '/libs/log.js');
module.exports = function (webserver, endpointPath) {
	/**
	 * Stream video or audio into browser
	 *
	 * @author https://medium.com/better-programming/video-stream-with-node-js-and-html5-320b3191a6b6
	 * @returns video/audio stream
	 */
	webserver.get(endpointPath, function (req, res) {
		res.statusCode = 200;
		try {
			if (!res.locals.fullPathFile) {
				throw new Error('Invalid path for streaming file');
			}
			if (!res.locals.mediaType) {
				throw new Error('File cannot be streamed because of missing media type.');
			}
			const ext = HFS.extname(res.locals.fullPathFile);
			if (req.path === '/api/video' && !(new FileExtensionMapper).getVideo(ext)) {
				throw new Error('File do not have file extension of video');
			} else if (req.path === '/api/audio' && !(new FileExtensionMapper).getAudio(ext)) {
				throw new Error('File do not have file extension of audio');
			}
			const fileSize = FS.statSync(res.locals.fullPathFile).size;
			const range = req.headers.range;
			if (range) {
				const parts = range.replace(/bytes=/, "").split("-");
				const start = parseInt(parts[0], 10);
				const end = (parts[1] ? parseInt(parts[1], 10) : fileSize - 1);
				const file = FS.createReadStream(res.locals.fullPathFile, {start, end});
				res.writeHead(206, {
					'Content-Range': `bytes ${start}-${end}/${fileSize}`,
					'Accept-Ranges': 'bytes',
					'Content-Length': (end - start) + 1, // chunk size
					'Content-Type': res.locals.mediaType
				});
				file.pipe(res);
			} else {
				res.writeHead(200, {
					'Content-Length': fileSize,
					'Content-Type': res.locals.mediaType
				});
				FS.createReadStream(res.locals.fullPathFile).pipe(res);
			}
		} catch (error) {
			res.statusCode = 404;
			res.result.setError('Error while loading file to stream: ' + error.message).end();
		}
	});
};
