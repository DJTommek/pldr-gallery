/*!
 * FileExtensionMapper
 */
class FileExtensionMapper {
	get(ext) {
		return this.all.hasOwnProperty(ext) ? this.all[ext] : null;
	}

	getImageExif() {
		let extensionsData = {};
		for (const extension in this.images) {
			if (this.images[extension].exifBuffer) {
				extensionsData[extension] = this.images[extension];
			}
		}
		return extensionsData;
	}

	getImage(ext) {
		return (this.images.hasOwnProperty(ext) ? this.images[ext] : null);
	}

	getVideo(ext) {
		return (this.videos.hasOwnProperty(ext) ? this.videos[ext] : null);
	}

	getAudio(ext) {
		return (this.audios.hasOwnProperty(ext) ? this.audios[ext] : null);
	}

	// loading into <img> tag
	constructor() {
		this.images = {
			apng: {
				'mediaType': 'image/apng',
				'icon': (new Icon).IMAGE,
			},
			bmp: {
				'mediaType': 'image/bmp',
				'icon': (new Icon).IMAGE,
			},
			gif: {
				'mediaType': 'image/gif',
				'icon': (new Icon).IMAGE,
			},
			ico: {
				'mediaType': 'image/x-icon',
				'icon': (new Icon).IMAGE,
			},
			cur: {
				'mediaType': 'image/x-icon',
				'icon': (new Icon).IMAGE,
			},
			jpg: {
				'mediaType': 'image/jpeg',
				'icon': (new Icon).IMAGE,
				'exifBuffer': 65527
			},
			jpeg: {
				'mediaType': 'image/jpeg',
				'icon': (new Icon).IMAGE,
				'exifBuffer': 65527
			},
			jfif: {
				'mediaType': 'image/jpeg',
				'icon': (new Icon).IMAGE,
				'exifBuffer': 65527
			},
			pjpeg: {
				'mediaType': 'image/jpeg',
				'icon': (new Icon).IMAGE,
				'exifBuffer': 65527
			},
			pjp: {
				'mediaType': 'image/jpeg',
				'icon': (new Icon).IMAGE,
				'exifBuffer': 65527
			},
			png: {
				'mediaType': 'image/png',
				'icon': (new Icon).IMAGE,
				'exifBuffer': 150000
			},
			svg: {
				'mediaType': 'image/svg+xml',
				'icon': (new Icon).IMAGE,
			},
			webp: {
				'mediaType': 'image/webp',
				'icon': (new Icon).IMAGE,
			},
		};
		// loading into <video> tag
		this.videos = {
			mp4: {
				'mediaType': 'video/mp4',
				'icon': (new Icon).VIDEO,
			},
			mov: {
				'mediaType': 'video/mp4',
				'icon': (new Icon).VIDEO,
			},
			webm: {
				'mediaType': 'video/webm',
				'icon': (new Icon).VIDEO,
			},
			ogv: {
				'mediaType': 'video/ogg',
				'icon': (new Icon).VIDEO,
			},
		};
		// loading into <audio> tag
		this.audios = {
			mp3: {
				'mediaType': 'audio/mpeg',
				'icon': (new Icon).AUDIO,
			},
			wav: {
				'mediaType': 'audio/wav',
				'icon': (new Icon).AUDIO,
			},
			ogg: {
				'mediaType': 'audio/ogg',
				'icon': (new Icon).AUDIO,
			},
		};
		// allowing to download
		this.downloads = {
			zip: {
				icon: (new Icon).ARCHIVE,
			},
			zip64: {
				icon: (new Icon).ARCHIVE,
			},
			'7z': {
				icon: (new Icon).ARCHIVE,
			},
			rar: {
				icon: (new Icon).ARCHIVE,
			},
			gz: {
				icon: (new Icon).ARCHIVE,
			},
			pdf: {
				'icon': (new Icon).PDF
			}, doc: {}, docx: {}, xls: {}, xlsx: {},
			avi: { // video but can't be played in browser
				'icon': (new Icon).VIDEO,
			},
		};
		this.all = {...this.images, ...this.videos, ...this.audios, ...this.downloads};
		this.regexAll = new RegExp('\\.(' + Object.keys(this.all).join('|') + ')$', 'i');
		this.regexExif = new RegExp('\\.(' + Object.keys(this.getImageExif()).join('|') + ')$', 'i');
	}
}

/**
 * This file is used also in nodejs backend, so these classes must be defined in "global"
 */
global = (typeof global === 'undefined') ? {} : global;
global.FileExtensionMapper = FileExtensionMapper;
