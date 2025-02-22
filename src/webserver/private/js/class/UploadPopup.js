class UploadPopup extends EventTarget {

	/**
	 * List of files, that are in loading or waiting to upload state.
	 */
	static _statusesUploading = [
		FilePond.FileStatus.INIT,
		FilePond.FileStatus.IDLE,
		FilePond.FileStatus.LOADING,
		FilePond.FileStatus.PROCESSING,
		FilePond.FileStatus.PROCESSING_QUEUED,
	];

	constructor() {
		super();

		this.filePond = null;
		this.isUploading = false;
	}

	/**
	 *
	 * @param {FilePond} filePond
	 * @return {this}
	 */
	init(filePond) {
		const self = this;

		this.filePond = filePond;

		/**
		 * @TODO this is not catching "retry"
		 */
		this.filePond.on('addfilestart', function (event) {
			self.isUploading = true;
			self.dispatchEvent(new CustomEvent('uploadStart'));
		});

		/**
		 * Dispatch event that all files were completed (both success and error). As of 2025-02-22 there is no native
		 * event, that would fire, so we need to listen for each file completed (bot success and error state) and fire
		 * our "all completed" event when all files are in completed state.
		 */
		this.filePond.on('processfile', function (event) {
			if (self._isUploading() === false) {
				self.isUploading = false;
				self.dispatchEvent(new CustomEvent('uploadDone'));
			}
		})

		return this;
	}

	/**
	 * Return true if no files are in uploading or waiting to upload state.
	 *
	 * @return {boolean}
	 * @private
	 */
	_isUploading() {
		const allFiles = this.filePond.getFiles();
		for (const file of allFiles) {
			if (UploadPopup._statusesUploading.includes(file.status)) {
				return true;
			}
		}

		return false;
	}
}
