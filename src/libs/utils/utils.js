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
