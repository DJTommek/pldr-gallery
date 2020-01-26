class Item {
	// Values defined by server (more defined dynamically)
	path = '/';
	// Default values
	isFolder = false;
	isFile = false;
	ext = '';
	isImage = false;
	isVideo = false;
	isAudio = false;
	isZip = false;
	isPdf = false;

	constructor(index, item) {
		Object.assign(this, item);
		this.index = index;

		this.url = pathToUrl(this.path);
		this.paths = this.path.split('/').filter(n => n); // split path to folders and remove empty elements (if path start or end with /)
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
}

class FolderItem extends Item {
	constructor(...args) {
		super(...args);
		this.isFolder = true;
		this.icon = (this.icon || 'folder-open');
	}
}

class FileItem extends Item {
	constructor(...args) {
		super(...args);
		this.created = new Date(this.created);
		this.isFile = true;
		this.ext = this.paths.last().split('.').last().toLowerCase();
		this.isImage = (['jpg', 'jpeg', 'png', 'bmp', 'gif'].indexOf(this.ext) >= 0);
		this.isVideo = (['mp4', 'webm', 'ogv'].indexOf(this.ext) >= 0);
		this.isAudio = (['mp3', 'wav', 'ogg'].indexOf(this.ext) >= 0);
		this.isZip = (['zip', 'zip64', '7z', 'rar', 'gz'].indexOf(this.ext) >= 0);
		this.isPdf = (['pdf'].indexOf(this.ext) >= 0);
		if (this.icon) {
			 // icon is set by server, do not override
		} else if (this.isImage) {
			this.icon = 'file-image-o';
		} else if (this.isVideo) {
			this.icon = 'file-video-o';
		} else if (this.isAudio) {
			this.icon = 'file-audio-o';
		} else if (this.isZip) {
			this.icon = 'file-archive-o';
		} else if (this.isPdf) {
			this.icon = 'file-pdf-o';
		} else {
			this.icon = 'file-o';
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
}

/**
 * Manage loaded items, currently selected item
 */
class Structure {
	constructor() {
		// currently selected item index
		this.selectedIndex = 0;
		// currently loaded folder (always FolderItem object)
		this.currentFolderItem = null;
		// currently opened file if popup is opened (FileItem object), null otherwise
		this.currentFileItem = null;

		this.items = [];
		this.files = [];
		this.folders = [];

	}
	/**
	 * Set currently loaded path
	 *
	 * @param path
	 */
	setCurrent(path) {
		path = decodeURI(path).replace(/^#/, '');

		let paths = path.split('/');
		let currentFolders = paths.slice(1, paths.length - 1); // slice first and last elements from array
		this.currentFileItem = null;

		// FileItem is requested, try find it in structure
		if (paths.last()) {
			this.currentFileItem = this.getByName(path);
			this.selectedIndex = (this.currentFileItem ? this.currentFileItem.index : 0);
		}

		let currentFolder = ('/' + currentFolders.join('/') + '/').replace('\/\/', '/');
		this.currentFolderItem = new FolderItem(null, {
			path: currentFolder
		});

		Settings.save('hashBeforeUnload', path)
	}

	/**
	 * Import all data into structure and generate all necessary data
	 * @param items
	 */
	setAll(items) {
		// clear all previous data
		this.items = [];
		this.files = [];
		this.folders = [];
		let index = 0;
		items.folders.forEach(function (item) {
			this.folders.push(new FolderItem(index, item));
			index++;
		}, this);
		items.files.forEach(function (item) {
			this.files.push(new FileItem(index, item));
			index++;
		}, this);
		this.items = this.folders.concat(this.files);
	}

	/**
	 * Manage moving selected item in structure
	 *
	 * @param direction
	 */
	selectorMove(direction) {
		let item = null;
		console.warn('Selector Move: ' + direction);
		switch (direction) {
			default: // Move to specific item defined by index number
				if (Number.isInteger(direction) && direction >= 0 && direction < this.items.length) {
					this.selectedIndex = direction;
				}
				break;
			case 'first': // Move into first item
				item = this.getFirst();
				break;
			case 'up': // Move to previous item than currently selected
				item = this.getPrevious(this.selectedIndex);
				break;
			case 'down': // Move to next item than currently selected
				item = this.getNext(this.selectedIndex);
				break;
			case 'last': //  // Move to last item
				item = this.getLast();
				break;
		}
		if (item) {
			this.selectedIndex = item.index;
		}
		// Mark selected item into HTML
		// css is indexing from one not zero
		$('#structure table tbody tr.structure-selected').removeClass('structure-selected');
		$('#structure table tbody tr:nth-child(' + (this.selectedIndex + 1) + ')').addClass('structure-selected');
		try {
			// center view to the selected item
			// Note: scrollIntoView is not jQuery function but DOM
			$('#structure table tbody tr.structure-selected')[0].scrollIntoView({
				block: 'center'
			});
		} catch (e) {
			// Be quiet! (probably just not supported)
		}
	}

	/**
	 * Run action on element (set item name into URL)
	 * In case of searching force-reload structure
	 */
	selectorSelect() {
		let item = this.getItem(this.selectedIndex);
		let self = this;
		if (item) {
			// Override default action with force refresh - cancel searching
			if (item.icon === 'long-arrow-left') {
				loadStructure(true, function () {
					self.selectorMove();
				});
			} else {
				window.location.hash = item.url;
			}
		}
	}

	/**
	 * Get all folders loaded into structure
	 *
	 * @returns []
	 */
	getFolders() {
		return this.folders;
	}

	/**
	 * Get all files loaded into structure
	 *
	 * @returns []
	 */
	getFiles() {
		return this.files;
	}

	/**
	 * Get all items (both files and folders) loaded into structure
	 *
	 * @returns []
	 */
	getItems() {
		return this.items;
	}

	/**
	 * Get currently loaded folder object
	 * Note: Index is null
	 *
	 * @returns {FolderItem}
	 */
	getCurrentFolder() {
		return this.currentFolderItem;
	}

	/**
	 * Get currently loaded file object
	 *
	 * @returns {FileItem|null}
	 */
	getCurrentFile() {
		return this.currentFileItem;
	}

	/**
	 * Get item by index
	 *
	 * @param index
	 * @returns {FileItem|FolderItem|null}
	 */
	getItem(index) {
		return this.items[index] || null;
	}

	/**
	 * Get first item in structure
	 *
	 * @returns {null|*}
	 */
	getFirst() {
		// initial index has to be -1 because next will be 0
		return this.getNext(-1);
	}

	/**
	 * Get first FileItem in structure
	 *
	 * @returns {FileItem|null}
	 */
	getFirstFile() {
		let item = this.getNext(-1);
		if (item) {
			if (item.isFolder) {
				return this.getNextFile(item.index);
			} else {
				return item;
			}
		}
		return null;
	}
	// get last visible item
	getLast() {
		// initial index has to be greater than index of last item
		return this.getPrevious(this.items.length);
	}

	/**
	 * Get next visible item based by index
	 *
	 * @param index
	 * @returns {FileItem|FolderItem|null}
	 */
	getNext(index) {
		index++;
		if (index > this.items.length) {
			return null;
		}
		let item = this.getItem(index);
		if (item && item.hide === false) {
			return item;
		}
		return this.getNext(index);
	}

	/**
	 * Get next visible file
	 *
	 * @param index
	 * @returns {FileItem|null}
	 */
	getNextFile(index) {
		index++;
		if (index > this.items.length) {
			return null;
		}
		let  item = this.getItem(index);
		if (item && item.hide === false && item.isFile) {
			return item;
		}
		return this.getNextFile(index);
	}

	/**
	 * Get previous visible item based by index
	 *
	 * @param index
	 * @returns {FileItem|FolderItem|null}
	 */
	getPrevious(index) {
		index--;
		if (index < 0) {
			return null;
		}
		let item = this.getItem(index);
		if (item && item.hide === false) {
			return item;
		}
		return this.getPrevious(index);
	}

	/**
	 * Get file by index
	 *
	 * @param index
	 * @returns {FileItem|null}
	 */
	getFile(index) {
		let item = this.getItem(index);
		return (item && item.isFile) ? item : null;
	}

	/**
	 * Get item by name
	 *
	 * @param name
	 * @returns {null}
	 */
	getByName(name) {
		let result = null;
		this.items.forEach(function (item) {
			if (item.path === name) {
				result = item;
			}
		}, this);
		return result;

	}
	/**
	 * Check text against item name. Regex is supported.
	 *
	 * @param searching
	 * @param text
	 * @returns {boolean} true if matches, false otherwise
	 */
	runFilter(searching, text) {
		if (searching.match(/^\/.+\/$/)) { // check, if string has delimiters is regex, at least /./
			searching = searching.slice(1, -1); // remove delimiters, new RegExp will add automatically
			return (new RegExp(searching)).test(text);
		} else {
			searching = searching.toLowerCase().trim();
			return (text.toLowerCase().trim().indexOf(searching) !== -1);
		}
	}

	/**
	 * Hide items which dont match to the filter text
	 * @TODO refactor, split if possible and move back into main.js
	 */
	filter() {
		const self = this;
		//Important note: Filter can change only if modal is closed.
		if (loadedStructure.modal) {
			console.warn('Filtering is not possible, modal window is active');
			return;
		}
		if (loadedStructure.filtering) {
			console.warn('Filtering is already running, new filtering cancelled');
			return;
		}
		const filterText = $('#filter input').val().toLowerCase();
		if (filterText.match(/^\/.+\/$/)) { // check, if string has delimiters is regex, at least /./
			// @TODO in case of regexp error, filter might be triggered twice so this alert message too
			try { // try if regex is valid before running filter
				new RegExp(filterText.slice(1, -1));
			} catch (exception) {
				console.warn('User input filter is not valid: ' + exception.message);
				alert('Filter is not valid: ' + exception.message);
				$('#filter .filtered').text(0);
				return;
			}
		}
		loadedStructure.filtering = true;
		let allHidden = true;
		let visible = 0;
		this.getItems().forEach(function (item) {
			// Do not touch on "go back" item! Should be visible all times
			if (item.noFilter) {
				return;
			}
			// display text to be compatibile with search results, otherwise it would be filtering only last part of path
			if (self.runFilter(filterText, item.text || item.paths.last())) {
				$("#structure tbody").find('[data-index="' + item.index + '"]').show();
				allHidden = false;
				item.hide = false;
				visible++;
			} else {
				item.hide = true;
				$("#structure tbody").find('[data-index="' + item.index + '"]').hide();
			}
		});
		if (allHidden) { // if no item passed filter, show warning
			$('#filter input').addClass('is-invalid');
		} else {
			$('#filter input').removeClass('is-invalid');
		}
		$('#filter .filtered').text(visible);
		const item = this.getItem(this.selectedIndex);
		if (!item) { // new opened folder is empty, do not move with selector
			loadedStructure.filtering = false;
			return;
		}
		if (item.hide) { // if currently selected item is not visible, move to previous visible
			this.selectorMove('up');
			if (this.getItem(this.selectedIndex).hide) { // if there is no previous visible item, move to the next visible item
				this.selectorMove('down');
			}
			// if no item is visible, dont do anything
		}
		if (this.getItem(this.selectedIndex).noFilter) { // if is filter active and selected item is "go back", try select next visible item
			this.selectorMove('down');
		}
		loadedStructure.filtering = false;
	}
}
