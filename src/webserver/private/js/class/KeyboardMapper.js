class KeyboardMapper extends EventTarget {
	/**
	 * @param {Structure} structure
	 * @param {MediaPopup} mediaPopup
	 * @param {Presentation} presentation
	 */
	constructor(structure, mediaPopup, presentation) {
		super();

		this.structure = structure;
		this.mediaPopup = mediaPopup;
		this.presentation = presentation;

		this.keyPageThresholdItems = 10;
		this.keyPageThresholdThumbnailRows = 4;
		this.filterEl = document.querySelector('#structure-search input');

		this._filterTimeoutId = null;
	}

	init() {
		const self = this;

		this.filterEl.addEventListener('keyup', this._onFilterInputChange.bind(this));
		this.filterEl.addEventListener('change', this._onFilterInputChange.bind(this));
		this.filterEl.addEventListener('paste', this._onFilterInputChange.bind(this));

		document.addEventListener('keydown', function (event) {
			console.debug('[KeyboardMapper] Keydown event (' + event.key + ')', event);
			switch (event.key) {
				case 'ArrowUp':
					if (self._isFilterFocused()) {
						document.activeElement.blur();
					}
					self.dispatchEvent(new CustomEvent('previous', {
						detail: {
							index: structure.getPrevious(self.structure.selectedIndex)?.index,
							key: event.key,
						},
					}));
					break;
				case 'ArrowLeft':
					self.dispatchEvent(new CustomEvent('previous', {
						detail: {
							index: structure.getPrevious(self.structure.selectedIndex)?.index,
							key: event.key,
						},
					}));
					break;
				case 'ArrowDown':
					document.activeElement.blur();
					self.dispatchEvent(new CustomEvent('next', {
						detail: {
							index: structure.getNext(self.structure.selectedIndex)?.index,
							key: event.key,
						},
					}));
					break;
				case 'ArrowRight':
					if (self._isFilterFocused()) {
						return;
					}
					self.dispatchEvent(new CustomEvent('next', {
						detail: {
							index: structure.getNext(self.structure.selectedIndex)?.index,
							key: event.key,
						},
					}));
					break;
				case 'Home':
					if (self._isFilterFocused()) {
						return;
					}
					if (self.mediaPopup.isActive()) {
						const firstFileItem = self.structure.getFirstFile();
						self.structure.selectorMove(firstFileItem.index);
						self.structure.selectorSelect();
					} else {
						self.structure.selectorMove('first');
					}
					break;
				case 'End':
					if (self._isFilterFocused()) {
						return;
					}
					self.structure.selectorMove('last');
					if (self.mediaPopup.isActive()) {
						self.structure.selectorSelect();
					}
					break;
				case 'PageUp':
					// @TODO prevent wiggle if moved at least once
					const moveUpBy = self._getMoveBy();
					for (let i = 0; i < moveUpBy; i++) {
						self.structure.selectorMove('up');
					}
					if (self.mediaPopup.isActive()) { // @TODO prevent selecting if not moved at all
						self.structure.selectorSelect();
					}
					break;
				case 'PageDown':
					// @TODO prevent wiggle if moved at least once
					const moveDownBy = self._getMoveBy();
					for (let i = 0; i < moveDownBy; i++) {
						self.structure.selectorMove('down');
					}
					if (self.mediaPopup.isActive()) { // @TODO prevent selecting if not moved at all
						self.structure.selectorSelect();
					}
					break;
				case 'Escape':
					if (loadedStructure.mediaInfoCanvas.isShown()) {
						loadedStructure.mediaInfoCanvas.hide();
					} else if (self.mediaPopup.isActive()) {
						self.mediaPopup.hide();
					} else if (self._isFilterEmpty() === false) {
						self.filterEl.value = '';
						self.structure.filter();
					} else if (self._isFilterFocused()) {
						document.activeElement.blur();
					} else {
						let item = self.structure.getFirst();
						if (item.text === '..') { // @HACK should be some property to recognize "go back"
							self.structure.selectorMove(item.index);
							self.structure.selectorSelect();
						}
					}
					break;
				case 'Backspace':
					if (loadedStructure.mediaInfoCanvas.isShown()) {
						loadedStructure.mediaInfoCanvas.hide();
					} else if (self.mediaPopup.isActive()) {
						self.mediaPopup.hide();
					} else {
						return;
					}
					break;
				case 'Enter':
					if (self.mediaPopup.isActive()) {
						self.mediaPopup.elementMediaOpenUrl.click();
					} else {
						self.structure.selectorSelect();
					}
					break;
				case ' ':
					if (event.ctrlKey === true && self.mediaPopup.isActive()) {
						self.presentation.toggle();
						flashMessage('Presentation mode ' + (self.presentation.running ? 'started' : 'stopped') + '.');
					} else if (self.mediaPopup.isActive() === false) {
						self.filterEl.focus();
						return;
					} else if (self.mediaPopup.itemCurrent.isImage) {
						self.mediaPopup.elementMediaOpenUrl.click();
					} else if (self.mediaPopup.itemCurrent.isVideo) {
						if (document.activeElement === self.mediaPopup.elementMediaVideo) {
							// if video is focused, space keyboard is default browser binding to toggle video so do nothing
						} else {
							self.mediaPopup.elementMediaVideo.paused ? self.mediaPopup.elementMediaVideo.play() : self.mediaPopup.elementMediaVideo.pause();
						}
					} else if (self.mediaPopup.itemCurrent.isAudio) {
						if (document.activeElement === self.mediaPopup.elementMediaAudio) {
							// if audio is focused, space keyboard is default browser binding to toggle audio so do nothing
						} else {
							self.mediaPopup.elementMediaAudio.paused ? self.mediaPopup.elementMediaAudio.play() : self.mediaPopup.elementMediaAudio.pause();
						}
					} else {
						// Do nothing and also prevent propagation
					}
					break;
				case 's':
					if (self.mediaPopup.isActive()) {
						if (event.ctrlKey === true) {
							$('#popup-media-details-download')[0].click();
						} else {
							return;
						}
					} else {
						self.filterEl.focus();
						return;
					}
					break;
				default:
					if (self.mediaPopup.isActive()) {
						return;
					}

					// Prevent focusing into filter when native shortcut is used. For example 'Select all' (CTRL+A),
					// Save current page into bookmark (CTRL+D), Save page (CTRL+S) and other.
					if (event.altKey === true || event.ctrlKey === true || event.metaKey === true) {
						return;
					}
					// If event.key has length just one it probably means, that event.key is character that it produces,
					// for example 'e', '1', ' ', 'Ž' and so on. Otherwise it is probably some special key.
					if (event.key.length === 1 ) {
						self.filterEl.focus();
					}
					return; // Do not prevent propagation
			}

			console.debug('[KeyboardMapper] Stopped immediate propagation');
			event.preventDefault();
			event.stopImmediatePropagation();
		});

		return this;
	}

	_getMoveBy() {
		return isTilesView()
			? (getTilesCount() * this.keyPageThresholdThumbnailRows)
			: this.keyPageThresholdItems;
	}

	_isFilterEmpty() {
		return this.filterEl.value === '';
	}

	_isFilterFocused() {
		return document.activeElement === this.filterEl;
	}

	/**
	 * @param {KeyboardEvent|Event} event
	 */
	_onFilterInputChange(event) {
		console.debug('[KeyboardMapper] _onFilterInputChange()', event);
		if (event.altKey === true || event.ctrlKey === true || event.metaKey === true) {
			return;
		}
		const self = this;
		clearTimeout(this._filterTimeoutId);
		$('#structure-search .filtered').html('<i class="fa fa-circle-o-notch fa-spin"></i>'); // @TODO in case of filtering, this "loading" might stuck
		this._filterTimeoutId = setTimeout(function () {
			self.structure.filter();
		}, 300); // @TODO this cooldown should be bigger when there is too many items to filter
	}
}
