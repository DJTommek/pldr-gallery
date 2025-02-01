const FS = require('fs');
const PATH = require('path');
const pathCustom = require('./path.js');
const LOG = require('./log.js');
const exifParser = require('exif-parser');
const ffmpeg = require('fluent-ffmpeg');

/**
 * Try to load metadata for given file either by:
 * - processing EXIF (first X bytes of file) typically for image
 * - loading file metadata via ffmpeg (ffprobe)
 *
 * @param {string} fullPath full absolute path to file
 * @returns {JSON} anonymous object eventually filled with metadata
 */
async function getDataFromExifFromFile(fullPath) {
	if (PATH.isAbsolute(fullPath) === false) {
		throw new Error('Parameter "fullPath" must be absolute path but "' + fullPath + '" given.')
	}
	if (fullPath.match(FileExtensionMapperInstance.regexMetadata) === null) {
		throw new Error('This file extension is not allowed to load metadata from.');
	}
	const extData = FileExtensionMapperInstance.get(pathCustom.extname(fullPath));
	if (extData === undefined) {
		throw new Error('This file extension has not defined metadata buffer.');
	}
	let result = {}
	if (extData.metadataBuffer === true) { // process by loading file metadata
		// convert callback into promise
		const parsed = await new Promise(function (resolve, reject) {
			ffmpeg.ffprobe(fullPath, function (error, metadata) {
				if (error) {
					reject(error)
				} else {
					resolve(metadata);
				}
			});
		});

		try {
			result.coords = parseFFProbeCoords(parsed.format.tags);
		} catch (error) {
			LOG.warning('Error while extracting location from file "' + fullPath + ' using FFProbe, error: "' + error + '". Full list of tags: ' + JSON.stringify(parsed));
		}

	} else if (typeof extData.metadataBuffer === 'number') {
		// how big in bytes should be buffer for loading EXIF from file (depends on specification)
		// https://ftp-osl.osuosl.org/pub/libpng/documents/pngext-1.5.0.html#C.eXIf
		// jpeg: 2^16-9 (65 527) bytes = 65.53 KB
		// png: 2^31-1 (2 147 483 647) bytes  = 2.15 GB

		// create small buffer, fill it with first x bytes from image and parse
		let metadataBuffer = new Buffer.alloc(extData.metadataBuffer);
		const fd = FS.openSync(fullPath, 'r');
		FS.readSync(fd, metadataBuffer, 0, extData.metadataBuffer, 0);
		FS.closeSync(fd);
		const parsed = exifParser.create(metadataBuffer).parse();

		result.coords = Coordinates.safe(parsed.tags.GPSLatitude, parsed.tags.GPSLongitude);

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
	} else {
		throw new Error('Invalid type of metadataBuffer parameter.');
	}
	return result;
}

module.exports.getDataFromExifFromFile = getDataFromExifFromFile;

/**
 * @param {object} tags
 * @return {Coordinates|null}
 */
function parseFFProbeCoords(tags) {
	if (!tags.location) {
		return null;
	}
	// Examples:
	// '+53.5523+009.9939/' -> N 53.5523, E 9.9939
	// '+52.0433-002.3759/' -> N 52.0433, W 2.3759
	const matches = tags.location.match(/([+-][0-9]{1,2}\.[0-9]+)([+-][0-9]{1,3}\.[0-9]+)\//);
	return new Coordinates(parseFloat(matches[1]), parseFloat(matches[2]));
}

/**
 * @param {string} absolutePath
 * @returns {string|null} Detected mime type or null
 */
function detectMimeType(absolutePath) {
	const ext = pathCustom.extname(absolutePath);
	const extData = FileExtensionMapperInstance.get(ext);
	return (extData && extData.mediaType) ? extData.mediaType : null;
}

module.exports.detectMimeType = detectMimeType;
