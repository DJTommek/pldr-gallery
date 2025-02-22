class Permission {
	/**
	 * @param {string} path
	 * @param {boolean} canWrite
	 */
	constructor(path, canWrite = false) {
		/** @type {string} */
		this.path = path;
		/** @type {boolean} */
		this.canWrite = canWrite;
	}
}

module.exports = Permission
