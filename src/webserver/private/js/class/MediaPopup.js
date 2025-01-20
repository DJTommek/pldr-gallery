class MediaPopup extends EventTarget {
	constructor(elementId, structure, loadedStructure) {
		super();

		this.elementId = elementId;
		this.element = document.getElementById(elementId);
		this.structure = structure;
		this.loadedStructure = loadedStructure;

		this.elementPopupContent = this.element.querySelector('.media-popup-content');
		this.elementPopupIcon = this.element.querySelector('.media-popup-icon');
		this.elementPrev = this.element.querySelector('.media-popup-prev');
		this.elementNext = this.element.querySelector('.media-popup-next')
		this.elementMediaOpenUrl = this.element.querySelector('.media-popup-open-media-url');

		this.elementMediaImg = this.element.querySelector('.media-popup-image');
		this.elementMediaAudio = this.element.querySelector('.media-popup-audio');
		this.elementMediaVideo = this.element.querySelector('.media-popup-video');
		this.elementMediaPdf = this.element.querySelector('.media-popup-pdf');

		this.itemCurrent = null;
		this.itemPrevious = null;
		this.itemNext = null;
	}

	wiggle() {
		const self = this;
		this.elementPopupContent.classList.add('wiggle');
		setTimeout(function () {
			self.elementPopupContent.classList.remove('wiggle');
		}, 1_000);
	}

	init() {
		const self = this;

		this.element
			.querySelector('.media-popup-close')
			.addEventListener('click', (event) => this.hide());

		/**
		 * Close popup if clicked on background area around media but not if clicked on any other element on page.
		 */
		this.elementPopupContent.addEventListener('click', function (event) {
			if (event.target !== self.elementPopupContent) {
				return;
			}
			vibrateApi.vibrate(Settings.load('vibrationOk'));
			self.hide();
			console.log(event);
		});

		this.elementPrev.addEventListener('click', function (event) {
			event.preventDefault();
			self.dispatchEvent(new CustomEvent('clickprevious', {
				detail: {
					index: parseInt(event.target.dataset.index) || null,
				},
			}));
		});

		this.elementNext.addEventListener('click', function (event) {
			event.preventDefault();
			self.dispatchEvent(new CustomEvent('clicknext', {
				detail: {
					index: parseInt(event.target.dataset.index) || null,
				},
			}));
		});

		const itemLoadingDone = function (event) {
			self.dispatchEvent(new CustomEvent('itemloaddone', {
				detail: {
					fileItem: self.itemCurrent,
				},
			}));
		}

		const itemLoadingError = function (event) {
			if (event.target.getAttribute('src') === '') {
				return; // On page load, ignore
			}
			self.dispatchEvent(new CustomEvent('itemloaderror', {
				detail: {
					fileItem: self.itemCurrent,
				},
			}));
		}

		this.elementMediaImg.addEventListener('load', itemLoadingDone);
		this.elementMediaVideo.addEventListener('loadedmetadata', itemLoadingDone);
		this.elementMediaAudio.addEventListener('loadedmetadata', itemLoadingDone);
		this.elementMediaPdf.addEventListener('load', itemLoadingDone);

		this.elementMediaImg.addEventListener('error', itemLoadingError);
		this.elementMediaVideo.addEventListener('error', itemLoadingError);
		this.elementMediaAudio.addEventListener('error', itemLoadingError);
		this.elementMediaPdf.addEventListener('error', itemLoadingError);

		return this;
	}

	isActive() {
		return this.element.style.display !== 'none';
	}

	/**
	 * @param {FileItem} fileItem
	 * @param {?FileItem} previousFileItem
	 * @param {?FileItem} nextFileItem
	 */
	showFileItem(fileItem, previousFileItem = null, nextFileItem = null) {
		if (!(fileItem instanceof FileItem)) {
			throw new Error('Invalid file item type.');
		}
		this.dispatchEvent(new CustomEvent('beforeshowitem', {
			detail: {
				fileItem: fileItem,
			},
		}));

		this.itemCurrent = fileItem;
		this.itemPrevious = previousFileItem;
		this.itemNext = nextFileItem;

		const self = this;

		let openUrl = fileItem.getFileUrl(false);
		let openUrlFull = fileItem.getFileUrl(false, false);
		const downloadUrl = fileItem.getFileUrl(true);
		const shareUrl = window.location.origin + '/#' + fileItem.url;

		// Canvas data
		console.log(fileItem);
		console.log(openUrl);
		console.log(this.elementPopupIcon);
		if (openUrl === null) { // If item has no view url, use icon to indicate it is file that has to be downloaded
			openUrl = downloadUrl;
			openUrlFull = downloadUrl;
			this.elementPopupIcon.className = 'media-popup-icon fa fa-5x fa-' + fileItem.icon;
			this.elementPopupIcon.style.display = 'block';
		} else {
			this.elementPopupIcon.className = 'media-popup-icon';
		}

		this.element.querySelector('.media-popup-open-media-url').setAttribute('href', openUrlFull);

		// @TODO fill and open media canvas (which is not in popup itself)
		$('#popup-media-details-download').attr('href', downloadUrl);
		$('#popup-media-details-open-full').attr('href', openUrlFull);
		$('#popup-media-details-share').attr('href', shareUrl);

		function setMediaSrc(type, src) {
			const element = (type === 'audio')
				? self.elementMediaAudio
				: self.elementMediaVideo;
			element.querySelector('source').setAttribute('src', src);
			if (!src) {
				element.style.display = 'none';
				element.load();
			} else {
				element.style.display = '';
			}
		}

		// First hide and reset all...
		setMediaSrc('audio', '');
		setMediaSrc('video', '');
		this.elementMediaPdf.style.display = 'none';
		this.elementMediaImg.style.display = 'none';

		// ... then enable only specific type

		if (fileItem.isImage) {
			this.elementMediaImg.setAttribute('src', openUrl);
			this.elementMediaImg.style.display = '';
		} else if (fileItem.isPdf) {
			this.elementMediaPdf.setAttribute('data', downloadUrl);
			this.elementMediaPdf.style = '';
		} else if (fileItem.isVideo) {
			setMediaSrc('video', openUrl);
		} else if (fileItem.isAudio) {
			setMediaSrc('audio', openUrl);
		} else {
			self.dispatchEvent(new CustomEvent('itemloaddone', {
				detail: {
					fileItem: self.itemCurrent,
				},
			}));
		}

		// generate URL for previous file buttons
		let prevFileUrl = fileItem.url; // default is current file (do nothing)
		if (previousFileItem && previousFileItem.isFile) { // if there is some previous file
			prevFileUrl = previousFileItem.url;
			this.elementPrev.dataset.index = previousFileItem.index;
		} else {
			this.elementPrev.dataset.index = '';
		}
		this.elementPrev.setAttribute('href', '#' + prevFileUrl);

		// generate URL for next file buttons
		let nextFileUrl = fileItem.url; // default is current file (do nothing)
		if (nextFileItem && nextFileItem.isFile) { // if there is some next file
			nextFileUrl = nextFileItem.url;
			this.elementNext.dataset.index = nextFileItem.index;
		} else {
			this.elementNext.dataset.index = ''
		}
		this.elementNext.setAttribute('href', '#' + nextFileUrl);

		this.element.style.display = 'block';
	}

	hide() {
		const self = this;
		this.element.style.display = 'none';
		this.elementMediaVideo.pause();
		this.elementMediaAudio.pause();
		this.dispatchEvent(new CustomEvent('afterhideitem', {
			detail: {
				fileItem: self.itemCurrent,
			},
		}));
	}
}
