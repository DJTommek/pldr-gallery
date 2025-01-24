/**
 * @TODO add support for aborting request https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch#canceling_a_request
 */
class ServerApi {
	/**
	 * @param {string} path
	 * @param {URLSearchParams} queryParams
	 * @return {Promise<void>}
	 * @private
	 */
	async _runApiRequest(path, queryParams) {
		console.debug('[ServerApi] Calling server API "' + path + '"...');
		const url = path + '?' + queryParams.toString();
		const response = await fetch(url);
		const result = await response.json();
		if (result.error === true) {
			console.debug('[ServerApi] Server API responsed with error "' + result.message + '".');
			throw new Error('API ' + path + ' returned an error: "' + result.message + '"');
		}

		console.debug('[ServerApi] Server API responsed with message "' + result.message + '".');
		return result;
	}

	/**
	 * @param {URLSearchParams} queryParams
	 */
	async search(queryParams) {
		return await this._runApiRequest('/api/search', queryParams);
	}
}
