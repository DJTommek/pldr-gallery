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
		this.isMap = false;
		this.size = null;
		this.scanned = null; // Date object for database
		this.distance = null; // dynamically created column just in SELECTs

		Object.assign(this, item);
		this.index = index;

		this.paths = this.path.split('/').filter(n => n); // split path to folders and remove empty elements (if path start or end with /)
		this.created = this.created ? new Date(this.created) : null;

		// folder path of item, where is located.
		// In case of FolderItem it is the same as this.path
		// In case of FileItem it is like this.path but without file name
		let folders = this.path.split('/');
		folders.pop();
		this.folder = folders.join('/') + '/';

		if (!this.text) { // do not override if set by server
			if (this.isRoot()) {
				this.text = this.path;
			} else {
				this.text = this.paths.last().escapeHtml()
			}
		}
		this.hide = item.hide ?? false;
		this.noFilter = item.noFilter ?? false;
	}

	getEncodedPath() {
		// @TODO Use PathEncoder.encode() instead
		return btoa(encodeURIComponent(this.path));
	}

	isRoot() {
		return this.path === '/';
	}

	toString() {
		return this.path;
	}

	/**
	 * @return {null|string}
	 */
	getThumbnailUrl() {
		return (this.isImage || this.isVideo || this.isFolder)
			? '/api/thumbnail?path=' + this.getEncodedPath()
			: null;
	}

	/**
	 * @return {string|null} Returns null if path is a root directory itself, otherwise name of file or directory.
	 */
	get basename() {
		return this.paths.last() ?? null;
	}
}

class ActionItem extends Item {
	constructor(index, item) {
		super(index, item);

		// action is required
		console.assert(typeof item.action === 'function');
		this.action = item.action

		this.icon = (this.icon || Icon.COMMAND);
		this.hide = item.hide ?? true;
		this.noFilter = item.noFilter ?? true;
	}

	run() {
		this.action();
	}
}

/*!
 * FolderItem
 */
class FolderItem extends Item {
	constructor(index, item) {
		super(index, item);
		this.isFolder = true;
		this.icon = (this.icon || Icon.FOLDER);
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
			created: this.created,
		};
		if (this.icon !== Icon.FOLDER) {
			result.icon = this.icon;
		}
		if (this.text !== this.paths.last()) {
			result.text = this.text;
		}
		if (this.noFilter === true) {
			result.noFilter = this.noFilter;
		}
		if (this.scanned) {
			result.scanned = this.scanned;
		}
		return result
	}

	/**
	 * Get folder archive URL
	 *
	 * @returns {string} URL for archive
	 */
	getArchiveUrl() {
		return '/api/archive?path=' + this.getEncodedPath();
	}
}

/*!
 * FileItem
 */
class FileItem extends Item {
	constructor(index, item) {
		super(index, item);
		this.isFile = true;
		this.ext = this.paths.last().split('.').last().toLowerCase();
		this.isImage = (FileExtensionMapperInstance.getImage(this.ext) !== null);
		this.isVideo = (FileExtensionMapperInstance.getVideo(this.ext) !== null);
		this.isAudio = (FileExtensionMapperInstance.getAudio(this.ext) !== null);
		this.isMap = (FileExtensionMapperInstance.getMap(this.ext) !== null);
		this.isPdf = this.ext === 'pdf';
		if (item.icon) {
			this.icon = item.icon;
		} else {
			const mapperData = FileExtensionMapperInstance.get(this.ext);
			if (mapperData && mapperData.icon) {
				this.icon = mapperData.icon;
			} else {
				this.icon = Icon.FILE;
			}
		}

		// Allow filling coordinate property either via:
		// - single "coords"
		// - two separate values "coordLat" and "coordLon"
		if (item.coords instanceof Coordinates) {
			this.coords = item.coords;
		} else {
			this.coords = Coordinates.safe(item.coordLat, item.coordLon);
		}

		this.coordLat = item.coordLat; // backward compatibility, use this.coords.lat instead
		this.coordLon = item.coordLon; // backward compatibility, use this.coords.lon instead

		this.width = item.width;
		this.height = item.height;
		this.distance = item.distance; // dynamically created column just in SELECTs
	}

	/**
	 * Get file URL
	 *
	 * @param {boolean} [download] get download URL instead of view
	 * @param {boolean} [compress] use true or false to force enable or disable compression. Set null to respect user settings
	 * @returns {null|string} URL or null if item type has no view URL
	 */
	getFileUrl(download = false, compress = null) {
		if (download === true) {
			return '/api/download?path=' + this.getEncodedPath();
		}
		if (this.isVideo) {
			return '/api/video?path=' + this.getEncodedPath();
		}
		if (this.isAudio) {
			return '/api/audio?path=' + this.getEncodedPath();
		}
		if (this.isImage) {
			let urlPath = '/api/image?path=' + this.getEncodedPath();
			if (compress !== null) {
				urlPath += '&compress=' + compress;
			}
			return urlPath;
		}
		return null;
	}

	/**
	 * @return {string}
	 */
	getTypeText() {
		if (this.isImage) {
			return 'image';
		} else if (this.isAudio) {
			return 'audio';
		} else if (this.isVideo) {
			return 'video';
		} else if (this.isMap) {
			return 'map';
		} else {
			return 'file';
		}
	}

	/**
	 * Return loading text
	 *
	 * @param compressed
	 */
	getStatusLoadingText(compressed) {
		let text = 'Loading ';
		if (this.isImage) {
			if (compressed === true) {
				text += 'compressed ';
			}
			text += 'image';
		} else if (this.isAudio) {
			text += 'audio';
		} else if (this.isVideo) {
			text += 'video';
		} else if (this.isMap) {
			text += 'map';
		} else {
			text += ' file';
		}
		return text + '...';
	}

	/**
	 * @return {String}
	 */
	get basenameNoExt() {
		return this.basename.replace(/\.[^/.]+$/, '');
	}

	/**
	 * Returns MIME type in format 'type/subtype', for example 'image/jpeg'.
	 *
	 * @return {string|null}
	 * @link https://developer.mozilla.org/en-US/docs/Web/HTTP/MIME_types
	 */
	get mimeType() {
		const extData = FileExtensionMapperInstance.get(this.ext);
		return (extData && extData.mediaType) ? extData.mediaType : null;
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

		if (Icon.DEFAULT_FILES.inArray(this.icon) === false) {
			result.icon = this.icon;
		}
		if (this.text !== this.paths.last()) {
			result.text = this.text;
		}
		if (this.noFilter === true) {
			result.noFilter = this.noFilter;
		}
		if (this.coords) {
			result.coordLat = this.coords.lat;
			result.coordLon = this.coords.lon;
		}
		if (this.width && this.height) {
			result.width = this.width;
			result.height = this.height;
		}
		if (this.scanned) {
			result.scanned = this.scanned;
		}
		if (this.distance) {
			result.distance = this.distance; // dynamically created column just in SELECTs
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
