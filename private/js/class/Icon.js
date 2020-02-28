/*!
 * Icon
 */
class Icon {
	constructor() {
		this.FOLDER = 'folder-open'; // default for folders
		this.FOLDER_GO_BACK = 'level-up';

		this.FILE = 'file-o'; // default for files
		this.IMAGE = 'file-image-o';
		this.VIDEO = 'file-video-o';
		this.AUDIO = 'file-audio-o';
		this.ARCHIVE = 'file-archive-o';
		this.PDF = 'file-pdf-o';

		this.CLOSE_SEARCHING = 'long-arrow-left'; // icon is reserved to close searching (force reload structure)

		this.DEFAULT_FILES = [this.FILE, this.IMAGE, this.VIDEO, this.AUDIO, this.PDF, this.ARCHIVE];
	}
}

/**
 * This file is used also in nodejs backend, so these classes must be defined in "global"
 */
global = (typeof global === 'undefined') ? {} : global;
global.Icon = Icon;
