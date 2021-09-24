const FS = require('fs');
const PATH = require('path');
const pathCustom = require('./path.js');
const readline = require('readline');
const LOG = require('./log.js');
const exifParser = require('exif-parser');

/**
 * The same as PATH.dirname but keep trailing /
 *
 * @param path
 */
function pathDirname(path) {
	path = PATH.join(PATH.dirname(path), '/');
	return path.replace(/\\/g, '/');
}

module.exports.pathDirname = pathDirname;

/**
 * Get content of file
 *
 * @param {{}} options
 * - {string} file which file do we want to read
 * - {number} [limit] limit number of files (default 1000), 0 = all
 * - {number} [offset] how many lines should be skipped (default 0)
 * - {number} [order] order of log lines (default 'ASC' = oldest first)
 * @param {function(string|null, Array)} callback
 */
function getFileLines(options, callback) {
	try {
		// check required parametr file name
		if (!options || !options.file) {
			throw new Error('Param "options.file" is required.');
		}
		// check optional parameter limit
		if (options.limit) {
			if (typeof options.limit !== 'number' || options.limit < 0) {
				throw new Error('Param options.limit is not valid. It must be positive number.');
			}
		} else { // set default value
			options.limit = 1000;
		}
		// check optional parameter offset
		if (options.offset) {
			if (typeof options.offset !== 'number' || options.offset < 0) {
				throw new Error('Param options.offset is not valid. It must be positive number.');
			}
			throw new Error('Param options.offset is not implemented.'); // @TODO implement offset
		} else { // set default value
			options.offset = 1000;
		}
		// check optional parameter order
		const allowedOrders = ['asc', 'desc'];
		if (options.order) {
			if (allowedOrders.inArray(options.order) === false) {
				throw new Error('Param options.order is not valid. It must be "' + allowedOrders.join('" or "') + '".');
			}
		} else { // set default value
			options.order = allowedOrders[0];
		}
	} catch (error) {
		return callback(error.message, []);
	}

	let fileStream = FS.createReadStream(options.file);
	fileStream.on('error', function (error) {
		return callback(error.message, []);
	});
	let readLogfile = readline.createInterface({
		input: fileStream
	});
	let lines = [];
	readLogfile.on('line', function (line) {
		if (options.limit > 0 && lines.length >= options.limit) {
			// Chceme jen posledních x řádků, udržujeme velikost pole
			// tj. u kazdeho pridaneho prvku je potreba odstranit prvni prvek v poli
			if (options.order === 'desc') {
				lines.shift();
			} else {
				readLogfile.close();
			}
		}
		lines.push(line);
	});
	readLogfile.on('close', function () {
		if (options.order === 'desc') {
			lines = lines.reverse();
		}
		callback(null, lines);
	});
}

module.exports.readFileContent = getFileLines;

/**
 * Check for requested path if is valid, allowed for user, etc
 *
 * @param {string} basePath Absolute path from config
 * @param {string} requestedPathBase64
 * @param {Array.<string>} userPermissions
 * @param {function(Array, string)} permsTest function whichaccept Array as list of permissions and string as path which should be checked. Returns boolean (true if should have permission)
 * @returns {{string}} JSON with basic values.
 * If attribute "error" is defined, something went wrong.
 * If attribute "path" is defined everything is ok. Also one of "fullPathFolder" or "fullPathFile" is defined too, depends on request
 */
function pathMasterCheck(basePath, requestedPathBase64, userPermissions, permsTest) {
	let result = {};
	if (typeof requestedPathBase64 !== 'string') {
		result.error = 'Parameter "requestedPathBase64" has to be string.';
		return result;
	}
	let path = requestedPathBase64;
	try {
		path = decodeURIComponent(Buffer.from(path, 'base64').toString());
	} catch (error) {
		result.error = error.message;
		return result;
	}
	result.queryPath = path;
	if (path.includes('\\')) { // Windows backslashes are not supported - everything has to be written in POSIX (UNIX) way.
		result.error = 'Backslash is not allowed';
		return result;
	} else if (path.indexOf('/') !== 0) {
		result.error = 'Query path has to start with forward slash';
		return result;
	} else if (path.includes('*')) { // this char is used for matching any number of characters (see npm module micromatch)
		result.error = 'Asterisk is not allowed';
		return result;
	} else if (path.includes('?')) { // this char is used for matching any character (see npm module micromatch)
		result.error = 'Questionmark is not allowed';
		return result;
	} else if (path.includes('/../') || path.includes('/./')) {
		result.error = 'Dynamic path is not allowed';
		return result;
	} else if (permsTest(userPermissions, path) === false) {
		// path is already normalized
		result.error = 'User do not have permissions to path "' + path + '"';
		return result;
	}

	const fullPath = pathCustom.relativeToAbsolute(path, basePath);
	let fileStats;
	try {
		fileStats = FS.lstatSync(fullPath); // throws exception if not exists or not accessible
	} catch (error) {
		if (error.code === 'ENOTDIR') {
			// requesting file but with suffixed slash, for example ./demo/
			// this is thrown only on UNIX. Windows don't care.
			result.error = 'Requested path "' + path + '" is not folder';
		} else {
			result.error = 'Cant load "' + path + '", error: ' + error.message;
		}
		return result;
	}
	if (fullPath.match(/\/$/)) { // requested path wants folder
		if (fileStats.isDirectory()) {
			result.fullPathFolder = fullPath;
		} else {
			result.error = 'Requested path "' + path + '" is not folder';
			return result
		}
	} else { // Requested path wants file
		if (fileStats.isFile()) {
			result.fullPathFile = fullPath;
		} else {
			result.error = 'Requested path "' + path + '" is not file';
			return result;
		}
	}
	// Everything is good to go
	result.path = path;
	return result;
}

module.exports.pathMasterCheck = pathMasterCheck;

module.exports.checkFileFolderAccess = function (absolutePath, relativePath, permTestFunction) {
	const requestedPathBase64 = (new Buffer.from(relativePath)).toString('base64');
	const passwordPermissionCheckResult = this.pathMasterCheck(absolutePath, requestedPathBase64, ['/'], permTestFunction);
	return (passwordPermissionCheckResult.error || false);
}

function getEndpointPath(filePath) {
	const file = PATH.basename(filePath, '.js');
	const folder = PATH.basename(PATH.dirname(filePath));
	return PATH.posix.join('/', folder, file);
}

module.exports.getEndpointPath = getEndpointPath;


function getDataFromExifFromFile(fullPath) {
	if (PATH.isAbsolute(fullPath) === false) {
		throw new Error('Parameter "fullPath" must be absolute path but "' + fullPath + '" given.')
	}
	if (fullPath.match((new FileExtensionMapper).regexExif) === null) {
		throw new Error('This file extension is not allowed to load EXIF data from.');
	}
	const extData = (new FileExtensionMapper).get(pathCustom.extname(fullPath));
	if (extData === undefined || typeof extData.exifBuffer !== 'number') {
		throw new Error('This file extension has not defined EXIF buffer.');
	}

	// how big in bytes should be buffer for loading EXIF from file (depends on specification)
	// https://ftp-osl.osuosl.org/pub/libpng/documents/pngext-1.5.0.html#C.eXIf
	// jpeg: 2^16-9 (65 527) bytes = 65.53 KB
	// png: 2^31-1 (2 147 483 647) bytes  = 2.15 GB

	// create small buffer, fill it with first x bytes from image and parse
	let exifBuffer = new Buffer.alloc(extData.exifBuffer);
	const fd = FS.openSync(fullPath, 'r');
	FS.readSync(fd, exifBuffer, 0, extData.exifBuffer, 0);
	FS.closeSync(fd);
	let parsed = exifParser.create(exifBuffer).parse();
	let result = {}

	if (parsed.tags.GPSLatitude && parsed.tags.GPSLongitude) {
		result.coordLat = numberRound(parsed.tags.GPSLatitude, 6);
		result.coordLon = numberRound(parsed.tags.GPSLongitude, 6);
	}

	if (parsed.imageSize && parsed.imageSize.height && parsed.imageSize.height) {
		result.width = parsed.imageSize.width;
		result.height = parsed.imageSize.height;
	} else if (parsed.tags.ImageWidth && parsed.tags.ImageHeight) {
		result.width = parsed.tags.ImageWidth;
		result.height = parsed.tags.ImageHeight;
	} else if (parsed.tags.ExifImageWidth && parsed.tags.ExifImageHeight) {
		result.width = parsed.tags.ExifImageWidth;
		result.height = parsed.tags.ExifImageHeight;
	} else {
		LOG.warning('File "' + fullPath + '" don\'t have any info about file resolution. Full list of available EXIF tags: ' + JSON.stringify(parsed));
	}
	return result;
}

module.exports.getDataFromExifFromFile = getDataFromExifFromFile;
