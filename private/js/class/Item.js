/*!
 * Item
 */
class Item {
	constructor(index, item) {
		this.path = '/';
		// Default values
		this.folder = '/';
		this.isFolder = false;
		this.isFile = false;
		this.ext = '';
		this.isImage = false;
		this.isVideo = false;
		this.isAudio = false;

		Object.assign(this, item);
		this.index = index;

		this.url = pathToUrl(this.path);
		this.paths = this.path.split('/').filter(n => n); // split path to folders and remove empty elements (if path start or end with /)

		// folder path of item, where is located.
		// In case of FolderItem it is the same as this.path
		// In case of FileItem it is like this.path but without file name
		let folders = this.path.split('/');
		folders.pop();
		this.folder = folders.join('/') + '/';

		this.urls = this.paths.map(pathToUrl); // split path to folders and remove empty elements (if path start or end with /)
		if (!this.text) { // do not override if set by server
			if (this.path === '/') { // special case for root
				this.text = this.path;
			} else {
				this.text = this.paths.last().escapeHtml()
			}
		}
		this.hide = false;
	}

	toString() {
		return this.path;
	}
}
/*!
 * FolderItem
 */
class FolderItem extends Item {
	constructor(...args) {
		super(...args);
		this.isFolder = true;
		this.icon = (this.icon || (new Icon).FOLDER);
	}

	/**
	 * Prepare data to send in AJAX
	 * - send only non-default data to save traffic
	 *
	 * @returns {{}}
	 */
	serialize() {
		let result = {
			path: this.path
		};
		if (this.icon !== (new Icon).FOLDER) {
			result.icon = this.icon;
		}
		if (this.text !== this.paths.last()) {
			result.text = this.text;
		}
		if (this.noFilter === true) {
			result.noFilter = this.noFilter;
		}
		return result
	}
}

/*!
 * FileItem
 */
class FileItem extends Item {
	constructor(...args) {
		super(...args);
		this.created = new Date(this.created);
		this.isFile = true;
		this.ext = this.paths.last().split('.').last().toLowerCase();
		this.isImage = ((new FileExtensionMapper).getImage(this.ext) !== null);
		this.isVideo = ((new FileExtensionMapper).getVideo(this.ext) !== null);
		this.isAudio = ((new FileExtensionMapper).getAudio(this.ext) !== null);
		if (args.icon) {
			this.icon = args.icon;
		} else {
			const mapperData = (new FileExtensionMapper).get(this.ext);
			if (mapperData && mapperData.icon) {
				this.icon = mapperData.icon;
			} else {
				this.icon = (new Icon).FILE;
			}
		}
	}

	/**
	 * Get file URL
	 *
	 * @param {boolean} [download] get download URL instead of view
	 * @returns {null|string} URL or null if item type has no view URL
	 */
	getFileUrl(download = false) {
		const decoded = btoa(encodeURIComponent(this.path));
		if (download === true) {
			return '/api/download?path=' + decoded;
		}
		if (this.isVideo) {
			return '/api/video?path=' + decoded;
		}
		if (this.isAudio) {
			return '/api/audio?path=' + decoded;
		}
		if (this.isImage) {
			return '/api/image?path=' + decoded;
		}
		return null;
	}

	/**
	 * Prepare data to send in AJAX
	 * - send only non-default data to save traffic
	 *
	 * @returns {{}}
	 */
	serialize() {
		let result = {
			path: this.path,
			size: this.size,
			created: this.created,
		};

		if ((new Icon).DEFAULT_FILES.inArray(this.icon) === false) {
			result.icon = this.icon;
		}
		if (this.text !== this.paths.last()) {
			result.text = this.text;
		}
		if (this.noFilter === true) {
			result.noFilter = this.noFilter;
		}
		if (this.coordLat && this.coordLon) {
			result.coordLat = this.coordLat;
			result.coordLon = this.coordLon;
		}
		return result
	}
}

/**
 * This file is used also in nodejs backend, so these classes must be defined in "global"
 */
global = (typeof global === 'undefined') ? {} : global;
global.Item = Item;
global.FileItem = FileItem;
global.FolderItem = FolderItem;
