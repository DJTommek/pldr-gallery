const crypto = require('crypto');

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
module.exports.md5 = function(input) {
	return crypto.createHash('md5').update(input).digest('hex');
}
