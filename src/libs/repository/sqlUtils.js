/**
 * Escape special characters that are used in query where in given string is used as parameter LIKE.
 *
 * @see https://dev.mysql.com/doc/refman/8.0/en/string-literals.html
 *
 * @param {string} parameter Unescaped parameter for LIKE. Example: `/some/percentage % in dirname/some_underscore in dirname/`
 * @return {string} `/some/percentage \% in dirname/some\_underscore in dirname/`
 */
module.exports.escapeLikeCharacters = function (parameter) {
	return parameter
		.replaceAll('%', '\\%') // escape wildcard character for everything
		.replaceAll('_', '\\_'); // escape wildcard character for single character
}
