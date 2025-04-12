const crypto = require('crypto');
const FS = require('fs/promises');
const PATH = require('path');

require('../../../src/webserver/private/js/class/Coordinates.js');

/**
 * Check, if any arguments is requesting showing help via typical attribute names
 *
 * @param {Array<string>} arguments
 * @returns {boolean}
 */
module.exports.requestingCmdHelp = function (arguments) {
	const argumentsLower = arguments.map(arg => arg.toLowerCase());
	const conditions = ['-h', '--h', '-help', '--help'];
	return conditions.some(condition => argumentsLower.includes(condition));
}


/**
 * Clamp (min-max) number between two numbers
 *
 * @param {number} input Input number to be checked
 * @param {?number} min Number must be equal or higher than this parameter (default 0) Set null to not limit
 * @param {?number} max Number must be equal or smaller than this parameter (default null) Set null to not limit
 * @returns {number}
 * @throws {Error}
 */
module.exports.clamp = function (input, min = 0, max = null) {
	if (typeof input !== 'number') {
		throw new Error('Invalid argument "input": expected "number" but got "' + typeof input + '"');
	}

	if (min === null && max === null) {
		return input; // no need to do anything
	}

	if (typeof min === 'number') {
		input = Math.max(input, min)
	} else if (min === null) {
		// valid, but do nothing
	} else {
		throw new Error('Invalid argument "min": expected "null" or "number" but got "' + typeof min + '"');
	}

	if (typeof max === 'number') {
		if (max < min) {
			throw new Error('Invalid order of arguments: "max" must be bigger or equal to "min".');
		}
		input = Math.min(input, max)
	} else if (max === null) {
		// valid, but do nothing
	} else {
		throw new Error('Invalid argument "max": expected "null" or "number" but got "' + typeof min + '"');
	}

	return input;
}

/**
 * Hash input text using md5
 *
 * @param {string} input
 * @returns {string}
 */
module.exports.md5 = function (input) {
	return crypto.createHash('md5').update(input).digest('hex');
}

/**
 * Exactly as native filesystem.lstat but returns null if path does not exists instead of throwing exception.
 *
 * @param path
 * @return {Promise<Stats|null>}
 */
module.exports.fsLstat = async function (path) {
	try {
		return await FS.lstat(path);
	} catch (error) {
		if (error.code === 'ENOENT') {
			return null;
		}
		throw error;
	}
}

/**
 * Smarter moving file, that handles errors related to unable to rename across multiple device (partitions) by fallback
 * to copy file to target path and delete source path.
 *
 * @param {string} sourcePath
 * @param {string }targetPath
 * @return {Promise<void>}
 */
module.exports.fsMove = async function (sourcePath, targetPath) {
	try {
		await FS.rename(sourcePath, targetPath);
	} catch (error) {
		if (error.code === 'EXDEV') {
			// Example of full error message which occures in Docker
			// "EXDEV: cross-device link not permitted, rename '/app/temp/upload/ae7b6ebf-9648-4dbe-8559-0ef00e1527b2.jpg' -> '/app/data/upload/path1/path2/some-filename.jpg'"
			await FS.copyFile(sourcePath, targetPath);
			await FS.unlink(sourcePath);
			return;
		}

		throw error;
	}
}

/**
 * Check if one path is in other path.
 *
 * @param {string} fromPath
 * @param {string} toPath
 * @return {boolean}
 */
module.exports.pathInPath = function (fromPath, toPath) {
	const relativePath = PATH.relative(fromPath, toPath);
	return relativePath && !relativePath.startsWith('..') && !PATH.isAbsolute(relativePath);
}

/**
 * Grab all available coordinates and return it's average.
 *
 * @param {object} geojson
 * @return {Coordinates}
 */
module.exports.geojsonAverageCoordinate = function (geojson) {
	const coordinates = [];
	for (const feature of geojson.features) {
		if (feature?.type !== 'Feature') {
			continue;
		}
		const geometryType = feature?.geometry?.type;

		if (geometryType === 'LineString') {
			coordinates.push(...feature?.geometry?.coordinates);
		} else if (geometryType === 'MultiPolygon') {
			for (const coordinates1 of feature.geometry.coordinates) {
				for (const coordinates2 of coordinates1) {
					coordinates.push(...coordinates2);
				}
			}
		}
	}

	if (coordinates.length === 0) {
		return null;
	}

	return new Coordinates(
		coordinates.reduce((partialSum, a) => partialSum + a[1], 0) / coordinates.length,
		coordinates.reduce((partialSum, a) => partialSum + a[0], 0) / coordinates.length,
	);
}

/**
 * Grab all available coordinates and return it's average.
 *
 * @param {object} xml
 * @return {Coordinates}
 */
module.exports.gpxAverageCoordinate = function (xml) {
	const allCoordinates = [];
	// Iterate track points
	const tracksRaw = xml?.gpx?.trk?.trkseg;
	if (tracksRaw !== undefined) {
		const tracks = Array.isArray(tracksRaw) ? tracksRaw : [tracksRaw];
		for (const track of tracks) {
			for (const trackPoint of track.trkpt) {
				const trackPointCoords = new Coordinates(trackPoint['@_lat'], trackPoint['@_lon']);
				allCoordinates.push(trackPointCoords);
			}
		}
	}

	// Iterate waypoints
	const waypointsRaw = xml?.gpx?.wpt
	if (waypointsRaw !== undefined) {
		const waypoints = Array.isArray(waypointsRaw) ? waypointsRaw : [waypointsRaw];
		for (const waypoint of waypoints) {
			const waypointCoords = new Coordinates(waypoint['@_lat'], waypoint['@_lon']);
			allCoordinates.push(waypointCoords);
		}
	}

	if (allCoordinates.length === 0) {
		return null;
	}

	return new Coordinates(
		allCoordinates.reduce((partialSum, a) => partialSum + a.lat, 0) / allCoordinates.length,
		allCoordinates.reduce((partialSum, a) => partialSum + a.lon, 0) / allCoordinates.length,
	);
}
