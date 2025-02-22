/*!
 * Structure
 * Manage loaded items, currently selected item
 */
class Structure extends EventTarget {

	static ACTION_INDEX_SEARCH_SUBDIRECTORY = 0;
	static ACTION_INDEX_SEARCH_ROOT = 1;

	constructor() {
		super();
		/**
		 * @type {number} Currently selected item index
		 */
		this.selectedIndex = 0;
		/**
		 * @type {FolderItem|null} Currently loaded directory
		 */
		this.currentFolderItem = null;
		/**
		 * @type {FileItem|null} Currently opened file if popup is opened, null otherwise
		 */
		this.currentFileItem = null;

		/** @type {array<Item>} */
		this.items = [];
		/** @type {array<FileItem>} */
		this.files = [];
		/** @type {array<FolderItem>} */
		this.folders = [];
		/** @type {array<ActionItem>} */
		this.actions = [];

		/** @type {array<FileItem|FolderItem>} */
		this.history = [];
	}

	/**
	 * Save visited item to history
	 *
	 * @param {FileItem|FolderItem} item
	 */
	historyAdd(item) {
		this.history.push(item);
		// keep memory clean by saving only last x items
		if (this.history.length > 10) {
			this.history = this.history.slice(-10);
		}
	}

	/**
	 * Return list of visited items
	 *
	 * @returns {array<FileItem|FolderItem>}
	 */
	historyGet() {
		return this.history;
	}

	/**
	 * Set currently loaded path
	 *
	 * @param {string} path
	 */
	setCurrent(path) {
		path = decodeURI(path).replace(/^#/, '');

		let paths = path.split('/');
		let currentFolders = paths.slice(1, paths.length - 1); // slice first and last elements from array
		this.currentFileItem = null;

		// FileItem is requested, try find it in structure
		if (paths.last()) {
			// on first structure load is always null but after each file item load is FileItem
			this.currentFileItem = this.getByPath(path);
			this.selectedIndex = (this.currentFileItem ? this.currentFileItem.index : 0);
		}
		const previousFolderItem = this.currentFolderItem;

		let currentFolder = ('/' + currentFolders.join('/') + '/').replace('\/\/', '/');
		this.currentFolderItem = new FolderItem(null, {
			path: currentFolder
		});

		if (previousFolderItem?.path !== this.currentFolderItem.path) {
			this.dispatchEvent(new CustomEvent('directorychange', {
				detail: {
					previousPath: previousFolderItem,
					newPath: this.currentFolderItem,
				},
			}));
		}
	}

	/**
	 * Import all data into structure and generate all necessary data
	 *
	 * @param {object} items Structured data from API
	 */
	setAll(items) {
		// clear all previous data
		this.items = [];
		this.actions = [];
		this.files = [];
		this.folders = [];

		const currentFolder = this.currentFolderItem;
		this.actions.push(new ActionItem(Structure.ACTION_INDEX_SEARCH_SUBDIRECTORY, {
			text: 'Vyhledat v podsložce <b>' + this.getCurrentFolder().toString().escapeHtml() + '</b>',
			action: async function () { await loadSearch(currentFolder); },
			icon: Icon.SEARCH,
			hide: true
		}));

		this.actions.push(new ActionItem(Structure.ACTION_INDEX_SEARCH_ROOT, {
			text: 'Vyhledat ve <b>všech</b> složkách',
			action: async function () { await loadSearch(new FolderItem(null, {path: '/'})); },
			icon: Icon.SEARCH,
			hide: true,
		}));

		let index = Structure.ACTION_INDEX_SEARCH_ROOT + 1;

		items.folders.forEach(function (item) {
			this.folders.push(new FolderItem(index, item));
			index++;
		}, this);
		items.files.forEach(function (item) {
			this.files.push(new FileItem(index, item));
			index++;
		}, this);
		this._recalculate();
	}

	_recalculate() {
		this.items = [].concat(this.actions, this.folders, this.files);
	}

	/**
	 * Manage moving selected item in structure
	 *
	 * @param {string|int} directionOrIndex
	 * @return {boolean} True if moving selector is valid. False if movement is not valid or it was prevented.
	 */
	selectorMove(directionOrIndex) {
		let oldItem = this.getItem(this.selectedIndex);
		let newItem = null;

		switch (directionOrIndex) {
			default: // Move to specific item defined by index number
				if (Number.isInteger(directionOrIndex) && directionOrIndex >= 0 && directionOrIndex < this.items.length) {
					newItem = this.getItem(directionOrIndex)
				}
				break;
			case 'first': // Move into first item
				newItem = this.getFirst();
				break;
			case 'up': // Move to previous item than currently selected
				newItem = this.getPrevious(this.selectedIndex);
				break;
			case 'down': // Move to next item than currently selected
				newItem = this.getNext(this.selectedIndex);
				break;
			case 'last': //  // Move to last item
				newItem = this.getLast();
				break;
		}

		const canContinue = this.dispatchEvent(new CustomEvent('beforeselectormove', {
			cancelable: true,
			detail: {
				oldItem: oldItem,
				newItem: newItem,
			},
		}));
		if (canContinue === false) {
			console.debug('[Structure] selectorMove cancelled because in "beforeselectormove" event listener.');
			return false;
		}

		if (newItem === null) {
			console.debug('[Structure] selectorMove cancelled because of non-existing newItem from direction "' + directionOrIndex + '"');
			return false;
		}

		this.selectedIndex = newItem.index;

		// Mark selected item into HTML
		$('.structure-selected').removeClass('structure-selected');
		$('.item-index-' + this.selectedIndex + '').addClass('structure-selected');
		try {
			// center view to the selected item
			// Note: scrollIntoView is not jQuery function but DOM
			$('#structure .structure-selected:visible')[0].scrollIntoView({
				block: 'center'
			});
		} catch (e) {
			// Be quiet! (probably just not supported)
		}
		return true;
	}

	/**
	 * Run action on element (set item name into URL)
	 * In case of searching force-reload structure
	 */
	selectorSelect() {
		let item = this.getItem(this.selectedIndex);
		if (!item) {
			return;
		}

		this.dispatchEvent(new CustomEvent('selectorselected', {
			detail: {
				pathItem: item,
			},
		}));
	}

	/**
	 * Get all folders loaded into structure
	 *
	 * @returns {array<FolderItem>}
	 */
	getFolders() {
		return this.folders;
	}

	/**
	 * @return {Array<ActionItem>}
	 */
	getActions() {
		return this.actions;
	}

	/**
	 * @param {number} index
	 * @returns {ActionItem|null}
	 */
	getAction(index) {
		return this.actions[index] ?? null;
	}

	/**
	 * Get all files loaded into structure
	 *
	 * @returns {array<FileItem>}
	 */
	getFiles() {
		return this.files;
	}

	/**
	 * Get all items (both files and folders) loaded into structure
	 *
	 * @returns {array<Item>}
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
	 * @param {number} index
	 * @returns {Item|null}
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

	/**
	 * Get last visible item
	 * @return {Item|null}
	 */
	getLast() {
		// initial index has to be greater than index of last item
		return this.getPrevious(this.items.length);
	}

	/**
	 * Get next visible item based by index
	 *
	 * @param index
	 * @returns {Item|null}
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
	 * @param {number} index
	 * @returns {FileItem|null}
	 */
	getNextFile(index) {
		index++;
		if (index > this.items.length) {
			return null;
		}
		let item = this.getItem(index);
		if (item && item.hide === false && item.isFile) {
			return item;
		}
		return this.getNextFile(index);
	}

	/**
	 * Get previous visible item based by index
	 *
	 * @param {number} index
	 * @returns {Item|null}
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
	 * @param {number} index
	 * @returns {FileItem|null}
	 */
	getFile(index) {
		let item = this.getItem(index);
		return (item && item.isFile) ? item : null;
	}

	/**
	 * Get item by path.
	 *
	 * @param {string} path
	 * @returns {Item|null}
	 */
	getByPath(path) {
		for (const item of this.items) {
			if (path === item.path) {
				return item;
			}
		}
		return null;
	}

	/**
	 * @param {boolean} showRoot
	 * @param {boolean} showSubdirectory
	 */
	showSearchActions(showRoot, showSubdirectory) {
		this.getAction(Structure.ACTION_INDEX_SEARCH_ROOT).hide = !showRoot;
		$('#structure .structure-item.item-index-' + Structure.ACTION_INDEX_SEARCH_ROOT + '').toggle(showRoot);

		this.getAction(Structure.ACTION_INDEX_SEARCH_SUBDIRECTORY).hide = !showSubdirectory;
		$('#structure .structure-item.item-index-' + Structure.ACTION_INDEX_SEARCH_SUBDIRECTORY + '').toggle(showSubdirectory);
	}

	/**
	 * @TODO Extract from this structure, for example into Utils..
	 *
	 * @param {RegExp} regex
	 * @param {string} text
	 * @return {array<object>}
	 */
	runFilterRegex(regex, text) {
		// searching = searching.slice(1, -1); // remove delimiters, new RegExp will add automatically
		// const re = RegExp(searching, 'gi');
		let match;
		let result = [];
		let i = 0;
		while ((match = regex.exec(text)) !== null) {
			if (i > 10000) {
				throw new Error('runFilterRegex failsafe, too many executions (' + i + '). Regex: "' + regex + '"');
			}
			i++;
			result.push({
				start: match.index,
				text: match[0],
			});
		}
		return result;
	}

	/**
	 * Hide structure items which do not match filter text.
	 *
	 * @TODO refactor, split if possible and move back into main.js
	 */
	filter() {
		const self = this;
		//Important note: Filter can change only if modal is closed.
		if (loadedStructure.filtering) {
			console.debug('Filtering is already running, new filtering cancelled');
			return;
		}
		try {
			let filterText = $('#structure-search input').val();
			// check, if string has delimiters, then make raw regex
			if (filterText.match(/^\/.+\/$/)) {
				filterText = filterText.slice(1, -1);
			} else { // escape regex characters and search as literal
				// trim only if string will not be empty
				// if (filterText.trim().length > 0) {
				// 	filterText = filterText.trim();
				// }
				// filterText = filterText.preg_quote();
				filterText = filterText.trim().preg_quote();
			}

			this.showSearchActions(
				filterText !== '',
				filterText !== '' && this.getCurrentFolder().isRoot() === false
			);

			const regex = new RegExp(filterText, 'gi');

			loadedStructure.filtering = true;
			let allHidden = true;
			let visible = 0;
			for (const item of this.getItems()) { // need to use for to allow break
				// Items with this attribute should be visible at all times
				if (item.noFilter) {
					continue;
				}

				let itemText = item.text;
				item.hide = true;

				// if string is empty, skip regexing and show all items (much faster)
				if (!filterText) {
					item.hide = false;
				} else {
					const filterResults = self.runFilterRegex(regex, itemText);
					if (filterResults.length > 0) {
						item.hide = false;
						filterResults.reverse().forEach(function (filterResult) {
							// highlight items, which are matching to filter (or hide otherwise)
							itemText = itemText.substring(0, filterResult.start) + '<span class="highlight">' + filterResult.text + '</span>' + itemText.substring(filterResult.start + filterResult.text.length);
						});
					}
				}

				const itemSelector = $('#structure .structure-item.item-index-' + item.index + '');
				itemSelector.children('.name').html(itemText);
				if (item.hide) {
					itemSelector.hide();
				} else {
					allHidden = false;
					visible++;
					itemSelector.show();
				}
			}

			if (allHidden) { // if no item passed filter, show warning
				$('#structure-search input').addClass('is-invalid');
				$('#filter-structure-empty').show();
			} else {
				$('#structure-search input').removeClass('is-invalid');
				$('#filter-structure-empty').hide();
			}
			$('#structure-search .filtered').text(visible);
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
		} catch (error) {
			// delete previous flash error message (if any) before showing new
			$('#filter-error').parent().remove();
			flashMessage('<p id="filter-error">Filter regex is not valid: <b>' + error.message + '</b></p>', 'danger');
			$('#structure-search .filtered').text('?');
		}
		loadThumbnail();
		loadedStructure.filtering = false;
	}
}
