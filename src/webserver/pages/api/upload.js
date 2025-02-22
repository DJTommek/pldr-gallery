const FSP = require('fs/promises');
const crypto = require('crypto');
const filenamify = (...args) => import('filenamify').then(({default: filenamify}) => filenamify(...args));

const CONFIG = require('../../../libs/config.js');
const LOG = require(BASE_DIR_GET('/src/libs/log.js'));
const structureRepository = require(BASE_DIR_GET('/src/libs/repository/structure.js'));
const PathEncoder = require('../../private/js/class/PathEncoder.js');
const PATH = require("path");
const HttpResponseError = require('../../../libs/HttpResponseError');
const Utils = require('../../../libs/utils/utils.js');

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

	webserver.delete(endpoint, endpointNotSupported);
	webserver.get(endpoint, endpointNotSupported);
	webserver.head(endpoint, endpointNotSupported);
	webserver.patch(endpoint, endpointNotSupported);

	webserver.post(endpoint, async function (req, res, next) {
		try {
			console.log('upload POST', req.url);

			const contentLength = parseInt(req.headers['content-length'])
			if (isNaN(contentLength)) {
				throw new HttpResponseError('Content-Length is missing', 400);
			}
			if (contentLength <= 0) {
				throw new HttpResponseError('Empty Content-Length is not allowed', 400);
			}

			// Quick check for max file size (exact check is done later)
			// Allow extra space for other content that are part of the request (eg form fields)
			if (contentLength > CONFIG.upload.fileMaxSize + (10 * 1024)) {
				throw new HttpResponseError('File is too big, max ' + formatBytes(CONFIG.upload.fileMaxSize), 400);
			}

			const response = new Response(req, {headers: req.headers});
			const formData = await response.formData();

			const [formFieldsRaw, formFile] = formData.getAll('files');

			if ((formFile instanceof File) === false) {
				throw new HttpResponseError('File is missing', 400);
			}
			if (typeof formFieldsRaw !== 'string') {
				throw new HttpResponseError('Form file fields are missing', 400);
			}

			if (formFile.name.length > CONFIG.upload.fileNameMaxLength) {
				throw new HttpResponseError('File name is too long', 400);
			}

			const formFileName = await filenamify(formFile.name, {
				replacement: '_',
				maxLength: CONFIG.upload.fileNameMaxLength,
			});

			const formFileExt = PATH.extname(formFileName).substring(1).toLowerCase(); // '.ext' -> 'ext'
			if (
				formFileExt === ''
				|| CONFIG.upload.allowedExtensions.includes(formFileExt) === false
			) {
				throw new HttpResponseError('File type is not allowed', 400);
			}

			const formFileSize = formFile.size;
			if (formFileSize === 0) {
				throw new HttpResponseError('Empty file is not allowed', 400);
			}
			if (formFileSize > CONFIG.upload.fileMaxSize) {
				throw new HttpResponseError('File is too big, max ' + formatBytes(CONFIG.upload.fileMaxSize), 400);
			}

			const structurePath = loadDirectoryFromFormFields(res, formFieldsRaw);
			const directoryItem = await structureRepository.getByPath(structurePath);
			if (
				directoryItem === null
				|| directoryItem.isFolder === false
				|| res.locals.user.testPathPermission(directoryItem.path, true, true) === false
			) {
				throw new HttpResponseError('You don\'t have permission to upload here', 403);
			}

			const randomUuid = crypto.randomUUID();

			const filenameTemp = randomUuid + '.' + formFileExt;
			const filePathTemp = PATH.join(CONFIG.upload.pathTemp, filenameTemp);

			await FSP.mkdir(PATH.dirname(filePathTemp), {recursive: true});
			await FSP.writeFile(filePathTemp, formFile.stream());

			const formFileNameNoExt = PATH.basename(formFileName, '.' + formFileExt);

			// If file already exists and if uploaded file has the same size as existing file, refuse upload.
			// If file has different size, then add suffix _xx to file name and do the check again.
			// @TODO Duplication check is naive, hash of file would be better but it is more resource and time consuming.
			let filePathFinal;
			let existingFileStats;
			let counter = 0;
			let fileNameFinal = formFileName;
			do {
				if (counter > 0) {
					// Suffix in form of _xx, as it is used in Android when more than one photo is taken in one second.
					fileNameFinal = formFileNameNoExt + '_' + counter.toString().padStart(2, '0') + '.' + formFileExt
				}
				filePathFinal = PATH.join(CONFIG.upload.pathFinal, directoryItem.path, fileNameFinal);
				existingFileStats = await Utils.fsLstat(filePathFinal);
				if (existingFileStats?.size === formFileSize) {
					throw new HttpResponseError('File already exists.', 400);
				}
				counter++;
			} while (existingFileStats !== null);

			await FSP.mkdir(PATH.dirname(filePathFinal), {recursive: true});
			await Utils.fsMove(filePathTemp, filePathFinal);

			LOG.info('User ID ' + res.locals.user.id + ' (IP ' + req.ip + ') uploaded file "' + directoryItem.path + '/' + fileNameFinal + '" (' + formatBytes(formFileSize) + ').');

			// Filepond is expecting file ID in plaintext body that will be used on file cancel
			return res.status(200).end(filenameTemp);
		} catch (error) {
			if (error instanceof HttpResponseError) {
				return res.result.setError(error.message).end(error.httpCode);
			}

			LOG.error('Error while processing uploaded file: ' + error.message);
			return res.result.setError('Try again later').end(500);
		}
	});
}

function loadDirectoryFromFormFields(res, formFieldsRaw) {
	try {
		const formFields = JSON.parse(formFieldsRaw);
		return PathEncoder.decode(formFields?.path);
	} catch (error) {
		throw new HttpResponseError('Form file fields are invalid', 400);
	}
}

function endpointNotSupported(req, res) {
	const errorMessage = req.method + ' "' + req.path + '" endpoint is not yet supported.';
	console.log(errorMessage, req);
	res.result.setError(errorMessage).end(400);
}
