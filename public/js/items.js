class Icons {
	static FOLDER = 'folder-open'; // default for folders
	static FOLDER_GO_BACK = 'level-up';

	static FILE = 'file-o'; // default for files
	static IMAGE = 'file-image-o';
	static VIDEO = 'file-video-o';
	static AUDIO = 'file-audio-o';
	static ARCHIVE = 'file-archive-o';
	static PDF = 'file-pdf-o';

	static CLOSE_SEARCHING = 'long-arrow-left'; // icon is reserved to close searching (force reload structure)

	static DEFAULT_FILES = [Icons.FILE, Icons.IMAGE, Icons.VIDEO, Icons.AUDIO, Icons.PDF, Icons.ARCHIVE];
}

class Item {
	path = '/';
	// Default values
	folder = '/';
	isFolder = false;
	isFile = false;
	ext = '';
	isImage = false;
	isVideo = false;
	isAudio = false;

	constructor(index, item) {
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

class FolderItem extends Item {
	constructor(...args) {
		super(...args);
		this.isFolder = true;
		this.icon = (this.icon || Icons.FOLDER);
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
		if (this.icon !== Icons.FOLDER) {
			result.icon = this.icon;
		}
		if (this.text !== this.paths.last()) {
			result.text = this.text;
		}
		if (this.hide === true) {
			result.hide = this.hide;
		}
		return result
	}
}

class FileItem extends Item {
	constructor(...args) {
		super(...args);
		this.created = new Date(this.created);
		this.isFile = true;
		this.ext = this.paths.last().split('.').last().toLowerCase();
		this.isImage = (FileExtensionMapper.getImage(this.ext) !== null) ;
		this.isVideo = (FileExtensionMapper.getVideo(this.ext) !== null);
		this.isAudio = (FileExtensionMapper.getAudio(this.ext) !== null);
		if (args.icon) {
			this.icon = args.icon;
		} else {
			const mapperData = FileExtensionMapper.get(this.ext);
			if (mapperData && mapperData.icon) {
				this.icon = mapperData.icon;
			} else {
				this.icon = Icons.FILE;
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
		if (Icons.DEFAULT_FILES.inArray(this.icon) === false) {
			result.icon = this.icon;
		}
		if (this.text !== this.paths.last()) {
			result.text = this.text;
		}
		if (this.hide === true) {
			result.hide = this.hide;
		}
		if (this.coordLat && this.coordLon) {
			result.coordLat = this.coordLat;
			result.coordLon = this.coordLon;
		}
		return result
	}
}

class FileExtensionMapper {
	static get(ext) {
		return this.all.hasOwnProperty(ext) ? this.all[ext] : null;
	}
	static getImageExif() {
		let extensionsData = {};
		for (const extension in this.images) {
			if (this.images[extension].exifBuffer) {
				extensionsData[extension] = this.images[extension];
			}
		}
		return extensionsData;
	}
	static getImage(ext) {
		return (this.images.hasOwnProperty(ext) ? this.images[ext] : null);
	}
	static getVideo(ext) {
		return (this.videos.hasOwnProperty(ext) ? this.videos[ext] : null);
	}
	static getAudio(ext) {
		return (this.audios.hasOwnProperty(ext) ? this.audios[ext] : null);
	}
}

/*
 * Workaround how to get properties into javascript static classes
 * @author https://stackoverflow.com/a/48012789/3334403
 */
// loading into <img> tag
FileExtensionMapper.images = {
	apng: {
		'mediaType': 'image/apng',
		'icon': Icons.IMAGE,
	},
	bmp: {
		'mediaType': 'image/bmp',
		'icon': Icons.IMAGE,
	},
	gif: {
		'mediaType': 'image/gif',
		'icon': Icons.IMAGE,
	},
	ico: {
		'mediaType': 'image/x-icon',
		'icon': Icons.IMAGE,
	},
	cur: {
		'mediaType': 'image/x-icon',
		'icon': Icons.IMAGE,
	},
	jpg: {
		'mediaType': 'image/jpeg',
		'icon': Icons.IMAGE,
		'exifBuffer': 65527
	},
	jpeg: {
		'mediaType': 'image/jpeg',
		'icon': Icons.IMAGE,
		'exifBuffer': 65527
	},
	jfif: {
		'mediaType': 'image/jpeg',
		'icon': Icons.IMAGE,
		'exifBuffer': 65527
	},
	pjpeg: {
		'mediaType': 'image/jpeg',
		'icon': Icons.IMAGE,
		'exifBuffer': 65527
	},
	pjp: {
		'mediaType': 'image/jpeg',
		'icon': Icons.IMAGE,
		'exifBuffer': 65527
	},
	png: {
		'mediaType': 'image/png',
		'icon': Icons.IMAGE,
		'exifBuffer': 150000
	},
	svg: {
		'mediaType': 'image/svg+xml',
		'icon': Icons.IMAGE,
	},
	webp: {
		'mediaType': 'image/webp',
		'icon': Icons.IMAGE,
	},
};
// loading into <video> tag
FileExtensionMapper.videos = {
	mp4: {
		'mediaType': 'video/mp4',
		'icon': Icons.VIDEO,
	},
	webm: {
		'mediaType': 'video/webm',
		'icon': Icons.VIDEO,
	},
	ogv: {
		'mediaType': 'video/ogg',
		'icon': Icons.VIDEO,
	},
};
// loading into <audio> tag
FileExtensionMapper.audios = {
	mp3: {
		'mediaType': 'audio/mpeg',
		'icon': Icons.AUDIO,
	},
	wav: {
		'mediaType': 'audio/wav',
		'icon': Icons.AUDIO,
	},
	ogg: {
		'mediaType': 'audio/ogg',
		'icon': Icons.AUDIO,
	},
};
// allowing to download
FileExtensionMapper.downloads = {
	zip: {
		icon: Icons.ARCHIVE,
	},
	zip64: {
		icon: Icons.ARCHIVE,
	},
	'7z': {
		icon: Icons.ARCHIVE,
	},
	rar: {
		icon: Icons.ARCHIVE,
	},
	gz: {
		icon: Icons.ARCHIVE,
	},
	pdf: {
		'icon': Icons.PDF
	}, doc: {}, docx: {}, xls: {}, xlsx: {},
	avi: { // video but can't be played in browser
		'icon': Icons.VIDEO,
	},
};
FileExtensionMapper.all = {...FileExtensionMapper.images, ...FileExtensionMapper.videos, ...FileExtensionMapper.audios, ...FileExtensionMapper.downloads};

/**
 * This file is used also in nodejs backend, so these classes must be defined in "global"
 */
global = (typeof global === 'undefined') ? {} : global;
global.Item = Item;
global.FileItem = FileItem;
global.FolderItem = FolderItem;
global.FileExtensionMapper = FileExtensionMapper;
global.Icons = Icons;
