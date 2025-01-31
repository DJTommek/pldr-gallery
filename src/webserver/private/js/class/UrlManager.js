class UrlManager extends EventTarget {
	/**
	 * @param {string?} queryRaw Provide raw query, for example from `window.location.search` variable in format
	 * `?param1=value1&param2=value2`
	 */
	constructor(queryRaw = null) {
		super();

		this._setRawQueryInternal(queryRaw);
	}

	setRawQuery(queryRaw) {
		this._setRawQueryInternal(queryRaw);
		this._triggerEvent();
		return this;
	}

	_setRawQueryInternal(queryRaw) {
		const query = new URLSearchParams(queryRaw);
		this.path = query.get('path') ?? null;
		this.file = query.get('file') ?? null;

		// Shorter URL to open file. Path (directory) is extracted from file parameter.
		// For example, these two URLs are the same:
		// - '/?path=/some/directory/&file=/some/directory/some-file.jpeg'
		// - '/?file=/some/directory/some-file.jpeg'
		if (this.path === null && this.file !== null) {
			const paths = this.file.split('/');
			paths.pop();
			this.path = paths.join('/') + '/';
		}

		return this;
	}

	setPath(path) {
		this.path = path;
		this._triggerEvent();
		return this;
	}

	withPath(path) {
		return (new UrlManager())
			.setPath(path)
			.setFile(this.file);
	}

	setFile(filePath) {
		this.file = filePath;
		this._triggerEvent();
		return this;
	}

	withFile(filePath) {
		return (new UrlManager())
			.setPath(this.path)
			.setFile(filePath);
	}

	/**
	 * Build URL from stored parameters and returns string.
	 *
	 * @return {string}
	 */
	getUrl() {
		const query = new URLSearchParams();
		if (this.path !== null) {
			query.set('path', this.path);
		}
		if (this.file !== null) {
			query.set('file', this.file);
		}

		let result = '/';
		let queryString = query.toString();
		if (queryString !== '') {
			queryString = queryString
				.replaceAll('%2F', '/')
				.replaceAll('%28', '(')
				.replaceAll('%29', ')');
			result += '?' + queryString;
		}

		return result;
	}

	/**
	 * @return {string}
	 */
	toString() {
		return this.getUrl();
	}

	_triggerEvent() {
		const url = this.getUrl();
		this.dispatchEvent(new CustomEvent('statechange', {
			detail: {
				url: url,
			},
		}));
	}
}

if (typeof module !== 'undefined') { // Add support for node.js
	module.exports = UrlManager;
}
