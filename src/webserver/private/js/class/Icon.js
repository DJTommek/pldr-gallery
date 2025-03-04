/*!
 * Icon
 */
class Icon {
	static FOLDER = 'folder-open'; // default for folders
	static FOLDER_GO_BACK = 'level-up';

	static FILE = 'file-o'; // default for files
	static IMAGE = 'file-image-o';
	static VIDEO = 'file-video-o';
	static AUDIO = 'file-audio-o';
	static ARCHIVE = 'file-archive-o';
	static MAP = 'map-o';
	static PDF = 'file-pdf-o';

	static COMMAND = 'bolt';
	static SEARCH = 'search';

	static CLOSE_SEARCHING = 'long-arrow-left'; // icon is reserved to close searching (force reload structure)

	static DEFAULT_FILES = [this.FILE, this.IMAGE, this.VIDEO, this.AUDIO, this.PDF, this.ARCHIVE];
}

/**
 * This file is used also in nodejs backend, so these classes must be defined in "global"
 */
global = (typeof global === 'undefined') ? {} : global;
global.Icon = Icon;
