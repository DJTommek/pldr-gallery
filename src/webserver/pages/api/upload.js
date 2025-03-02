const filenamify = (...args) => import('filenamify').then(({default: filenamify}) => filenamify(...args));

const PATH = require('path');

const CONFIG = require('../../../libs/config.js');
const LOG = require('../../..//libs/log.js');

const structureRepository = require('../../../libs/repository/structure.js');
const PathEncoder = require('../../private/js/class/PathEncoder.js');
const HttpResponseError = require('../../../libs/HttpResponseError');
const UploadManager = require('../../../libs/uploader/UploadManager.js');

/**
 * @HACK filepond UI is broken if error messages are too long so keep it short.
 */
module.exports = function (webserver, endpoint) {
	webserver.all(endpoint, async function (req, res, next) {
		if (CONFIG.upload.enabled !== true) {
			return res.result.setError('Uploading files is disabled.').end(400);
		}
		next();
	});

	/**
	 * Uploader want's to start chunked upload.
	 *
	 * Check if file of this name and size does not already exists in this directory. If so, refuset to accept upload.
	 */
	webserver.post(endpoint, async function (req, res, next) {
		try {
			if (req.is('multipart/form-data') === false) {
				throw new HttpResponseError('Invalid Content-Type, expected multipart/form-data', 400);
			}

			const expectedFinalFileSize = loadPositiveNumberHeader(req, 'Upload-Length', 0);
			if (expectedFinalFileSize <= 0) {
				throw new HttpResponseError('Empty file is not allowed.', 400);
			}
			if (expectedFinalFileSize > CONFIG.upload.fileMaxSize) {
				throw new HttpResponseError('File is too big, max ' + formatBytes(CONFIG.upload.fileMaxSize), 400);
			}

			// Validate, that content length is not too big - it should contain only file metadata.
			loadPositiveNumberHeader(req, 'Content-Length', 0, 100 * 1024); // 100 KB

			const response = new Response(req, {headers: req.headers});
			const formData = await response.formData();

			const formFieldsRaw = formData.get('files');
			if (typeof formFieldsRaw !== 'string') {
				throw new HttpResponseError('Form file fields are missing', 400);
			}

			const [structurePath, fileNameRequested] = loadDirectoryAndFileNameFromFormFields(formFieldsRaw);

			const fileNameSanitized = await UploadManager.sanitizeFilename(fileNameRequested);
			const formFileExt = PATH.extname(fileNameSanitized).substring(1).toLowerCase(); // '.ext' -> 'ext'
			if (
				formFileExt === ''
				|| CONFIG.upload.allowedExtensions.includes(formFileExt) === false
			) {
				throw new HttpResponseError('File type is not allowed', 400);
			}

			const directoryItem = await structureRepository.getByPath(structurePath);
			if (
				directoryItem === null
				|| directoryItem.isFolder === false
				|| res.locals.user.testPathPermission(directoryItem.path, true, true) === false
			) {
				throw new HttpResponseError('You don\'t have permission to upload here', 403);
			}

			const uploadId = UploadManager.generateUploadId();
			const uploadManager = new UploadManager(uploadId);
			await uploadManager.initNewUpload(directoryItem.path, fileNameSanitized, expectedFinalFileSize)

			LOG.info('User ID ' + res.locals.user.id + ' (IP ' + req.ip + ') started chunked uploading file "' + directoryItem.path + '" (' + formatBytes(expectedFinalFileSize) + ').');

			// Filepond is expecting file ID in plaintext body that will be used on file cancel
			return res.status(200).end(uploadId);
		} catch (error) {
			if (error instanceof HttpResponseError) {
				return res.result.setError(error.message).end(error.httpCode);
			}

			LOG.error('Error while processing initialization of chunk file upload: ' + error.message);
			return res.result.setError('Try again later').end(500);
		}
	});

	/**
	 * Uploader is sending chunk of file.
	 *
	 * When all chunks are received, all parts are merged together and moved into a final location.
	 */
	webserver.patch(endpoint, async function (req, res) {
		try {
			const uploadId = req.query.patch;
			loadPositiveNumberHeader(req, 'Upload-Length', 1, CONFIG.upload.fileMaxSize);
			const chunkSize = loadPositiveNumberHeader(req, 'Content-Length', 1, CONFIG.upload.uploadChunkSize);
			const chunkOffset = loadPositiveNumberHeader(req, 'Upload-Offset', 0, CONFIG.upload.fileMaxSize);

			if (Buffer.isBuffer(req.body) === false) {
				throw new HttpResponseError('Invalid request body.', 400);
			}

			if (chunkSize !== req.body.length) {
				throw new HttpResponseError('Content-Length does not match with provided content body.', 400);
			}

			let uploadManager;
			try {
				uploadManager = new UploadManager(uploadId);
				await uploadManager.initExistingUpload();
			} catch (error) {
				throw new HttpResponseError('Upload session ID does not exists.', 400);
			}

			await uploadManager.writeChunk(chunkOffset, req.body);
			const expectedFilePath = uploadManager.directory + '/' + uploadManager.fileName;

			const logMessage = 'User ID ' + res.locals.user.id + ' (IP ' + req.ip + ') finished uploading ' + formatBytes(chunkSize) + ' chunk'
				+ ' (' + chunkOffset + ' - ' + (chunkOffset + chunkSize) + ' / ' + uploadManager.fileSize + ')'
				+ ' of file  "' + expectedFilePath + '".'
				+ ' Total size: ' + formatBytes(uploadManager.fileSize) + ','
				+ ' Done: ' + formatBytes(chunkOffset + chunkSize) + ','
				+ ' Remaining: ' + formatBytes(uploadManager.fileSize - chunkOffset - chunkSize);
			LOG.debug(logMessage);

			if (await uploadManager.areAllChunksUploaded()) {
				// @TODO completing upload might take a long time on slower drives. Maybe would be useful, to send
				//       response before completing upload and then start completing upload.
				const realFileAbsolutePath = await uploadManager.completeUpload();
				await uploadManager.validateCompletedUpload(realFileAbsolutePath);
				await uploadManager.cleanup();
				LOG.info('User ID ' + res.locals.user.id + ' (IP ' + req.ip + ') finished uploading all chunks of file "' + expectedFilePath + '" (' + formatBytes(uploadManager.fileSize) + ').');

				const realFileName = PATH.basename(realFileAbsolutePath);
				res.result.setResult(
					{filename: realFileName},
					'All file chunks were received and new file "' + realFileName + '" was created.',
				).end(201);
			} else {
				return res.result.setResult({}, 'File chunk was saved.').end(201);
			}

		} catch (error) {
			if (error instanceof HttpResponseError) {
				return res.result.setError(error.message).end(error.httpCode);
			}

			console.error(error);
			LOG.error('Error while processing incoming chunk: ' + error.message);
			return res.result.setError('Try again later').end(500);
		}
	});

	/**
	 * Uploader want's to know, from which chunk file upload should continue.
	 *
	 * Returns offset in bytes of file chunk with biggest offset.
	 * If session does not exist, start uploading from first chunk.
	 */
	webserver.get(endpoint, async function (req, res) {
		try {
			const uploadId = req.query.patch;
			const uploadManager = new UploadManager(uploadId);
			await uploadManager.initExistingUpload();
			const lastChunkOffset = await uploadManager.getLastChunkOffset();
			res.setHeader('Upload-Offset', lastChunkOffset);
			return res.result.setResult({chunkBiggestOffset: lastChunkOffset}, 'Chunk with biggest offset starts at ' + formatBytes(lastChunkOffset) + '.').end(200);
		} catch (error) {
			if (error instanceof HttpResponseError) {
				return res.result.setError(error.message).end(error.httpCode);
			}

			LOG.error('Error while processing HEAD requets of upload endpoint: ' + error.message);
			return res.result.setError('Try again later').end(500);
		}
	});

	/**
	 * Uploader requests to delete file.
	 *
	 * Delete all temporary files related to given upload session ID but not final file.
	 */
	webserver.delete(endpoint, async function (req, res) {
		try {
			const uploadId = req.query.patch;
			const uploadManager = new UploadManager(uploadId);
			await uploadManager.cleanup();
			return res.result.setResult(null, 'Temporary files related to upload session ID "' + uploadId + '" were deleted.').end(200);
		} catch (error) {
			if (error instanceof HttpResponseError) {
				return res.result.setError(error.message).end(error.httpCode);
			}

			LOG.error('Error while processing DELETE requets of upload endpoint: ' + error.message);
			return res.result.setError('Try again later').end(500);
		}
	});
}

function loadDirectoryAndFileNameFromFormFields(formFieldsRaw) {
	try {
		const formFields = JSON.parse(formFieldsRaw);
		const path = PathEncoder.decode(formFields?.path);
		const filename = formFields?.name;
		if (typeof path !== 'string' || typeof filename !== 'string') {
			throw new Error();
		}
		return [path, filename]
	} catch (error) {
		throw new HttpResponseError('Form file fields are invalid', 400);
	}
}

function endpointNotSupported(req, res) {
	const errorMessage = req.method + ' "' + req.path + '" endpoint is not yet supported.';
	console.log(errorMessage, req);
	res.result.setError(errorMessage).end(400);
}

/**
 * @return {number}
 */
function loadPositiveNumberHeader(req, headerName, minimum = null, maximum = null) {
	const headerValue = parseInt(req.header(headerName));
	if (isNaN(headerValue)) {
		throw new HttpResponseError(headerName + ' is missing or invalid', 400);
	}
	if (minimum !== null && headerValue < minimum) {
		throw new HttpResponseError('Minimum size of ' + headerName + ' is ' + minimum, 400);
	}
	if (maximum !== null && headerValue > maximum) {
		throw new HttpResponseError('Maximum size of ' + headerName + ' is ' + minimum, 400);
	}
	return headerValue;
}
