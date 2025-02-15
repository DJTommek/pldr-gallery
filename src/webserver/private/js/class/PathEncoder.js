class PathEncoder {
	/**
	 * Encode plain path into decoded version, that can be send as part of URL.
	 *
	 * @example decode('/') === 'JTJG'
	 * @example decode('/demo/files/') === 'JTJGZGVtbyUyRmZpbGVzJTJG'
	 *
	 * @param {string} path
	 * @return {string}
	 */
	static encode(path) {
		throw new Error('@TODO Needs to be implemented');
	}

	/**
	 * Decode requested path into plain text.
	 *
	 * @example decode('JTJG') === '/'
	 * @example decode('JTJGZGVtbyUyRmZpbGVzJTJG') === '/demo/files/'
	 * @param {string} encodedPath
	 * @return {string}
	 */
	static decode(encodedPath) {
		let decodedPath;
		try {
			decodedPath = decodeURIComponent(Buffer.from(encodedPath, 'base64').toString());
		} catch (error) {
			throw new Error('Path has invalid format.');
		}

		if (decodedPath.startsWith('/') === false) {
			throw new Error('Path is not valid.');
		}
		return decodedPath;
	}
}

if (typeof module !== 'undefined') { // Add support for node.js
	module.exports = PathEncoder;
}
