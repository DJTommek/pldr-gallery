/*!
 * FileExtensionMapper
 */
class FileExtensionMapper {
	get(ext) {
		return this.all.hasOwnProperty(ext) ? this.all[ext] : null;
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

	/**
	 * Convert extension into media type string
	 * @example 'jpg' -> 'image/jpeg'
	 *
	 * @param {string} extension
	 * @return {string|null} Returns null if unable to map.
	 */
	getMediaType(extension) {
		const extData = this.get(extension);
		return extData?.mediaType ?? null;
	}

	constructor() {
		this.images = { // loading into <img> tag
			apng: {
				'mediaType': 'image/apng',
				'icon': Icon.IMAGE,
			},
			bmp: {
				'mediaType': 'image/bmp',
				'icon': Icon.IMAGE,
			},
			gif: {
				'mediaType': 'image/gif',
				'icon': Icon.IMAGE,
			},
			ico: {
				'mediaType': 'image/x-icon',
				'icon': Icon.IMAGE,
			},
			cur: {
				'mediaType': 'image/x-icon',
				'icon': Icon.IMAGE,
			},
			jpg: {
				'mediaType': 'image/jpeg',
				'icon': Icon.IMAGE,
				'metadataBuffer': 65527
			},
			jpeg: {
				'mediaType': 'image/jpeg',
				'icon': Icon.IMAGE,
				'metadataBuffer': 65527
			},
			jfif: {
				'mediaType': 'image/jpeg',
				'icon': Icon.IMAGE,
				'metadataBuffer': 65527
			},
			pjpeg: {
				'mediaType': 'image/jpeg',
				'icon': Icon.IMAGE,
				'metadataBuffer': 65527
			},
			pjp: {
				'mediaType': 'image/jpeg',
				'icon': Icon.IMAGE,
				'metadataBuffer': 65527
			},
			png: {
				'mediaType': 'image/png',
				'icon': Icon.IMAGE,
				'metadataBuffer': 150000
			},
			svg: {
				'mediaType': 'image/svg+xml',
				'icon': Icon.IMAGE,
			},
			webp: {
				'mediaType': 'image/webp',
				'icon': Icon.IMAGE,
			},
		};
		this.videos = { // loading into <video> tag
			mp4: {
				'mediaType': 'video/mp4',
				'icon': Icon.VIDEO,
				'metadataBuffer': true,
			},
			mov: {
				'mediaType': 'video/mp4',
				'icon': Icon.VIDEO,
			},
			webm: {
				'mediaType': 'video/webm',
				'icon': Icon.VIDEO,
			},
			ogv: {
				'mediaType': 'video/ogg',
				'icon': Icon.VIDEO,
			},
		};
		this.audios = { // loading into <audio> tag
			mp3: {
				'mediaType': 'audio/mpeg',
				'icon': Icon.AUDIO,
			},
			wav: {
				'mediaType': 'audio/wav',
				'icon': Icon.AUDIO,
			},
			ogg: {
				'mediaType': 'audio/ogg',
				'icon': Icon.AUDIO,
			},
		};
		this.downloads = { // allowing to download
			zip: {
				icon: Icon.ARCHIVE,
			},
			zip64: {
				icon: Icon.ARCHIVE,
			},
			'7z': {
				icon: Icon.ARCHIVE,
			},
			rar: {
				icon: Icon.ARCHIVE,
			},
			gz: {
				icon: Icon.ARCHIVE,
			},
			pdf: {
				'icon': Icon.PDF
			}, doc: {}, docx: {}, xls: {}, xlsx: {},
			avi: { // video but can't be played in browser
				'icon': Icon.VIDEO,
			},
			mpg: { // video but can't be played in browser
				'icon': Icon.VIDEO,
			},
			heic: { // image but can't be displayed in browser (@TODO https://github.com/lovell/sharp/issues/1105#issuecomment-516010573)
				'mediaType': 'image/heic',
				'icon': Icon.IMAGE,
			},
		};
		this.all = {...this.images, ...this.videos, ...this.audios, ...this.downloads};
		this.regexAll = new RegExp('\\.(' + Object.keys(this.all).join('|') + ')$', 'i');

		// Get extensions, that can contain metadata
		let extensionsData = {};
		for (const extension in this.all) {
			if (this.all[extension].metadataBuffer) {
				extensionsData[extension] = this.all[extension];
			}
		}
		this.regexMetadata = new RegExp('\\.(' + Object.keys(extensionsData).join('|') + ')$', 'i');
	}
}

const FileExtensionMapperInstance = new FileExtensionMapper();

/**
 * This file is used also in nodejs backend, so these classes must be defined in "global"
 */
global = (typeof global === 'undefined') ? {} : global;
global.FileExtensionMapper = FileExtensionMapper;
global.FileExtensionMapperInstance = FileExtensionMapperInstance;
