const loadedStructure = {
	mediaInfoCanvas: null, // MediaDetailsCanvas instance
	filtering: false,
	flashIndex: 0, // incremental index used for flashMessage()
	hoveredStructureItemElement: null,
	user: null,
};
const transparentPixelBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII';

const urlManager = new UrlManager();
const vibrateApi = new VibrateApi();
const structure = new Structure();
const mediaPopup = new MediaPopup('media-popup', structure, loadedStructure).init();
const uploadPopup = new UploadPopup();
const presentation = new Presentation(mediaPopup).init();
const keyboardMapper = new KeyboardMapper(structure, mediaPopup, presentation).init();
const serverApi = new ServerApi();

let windowPopStateRunning = false;

/**
 * Forget current application state and fully load new state from provided URL query parameters.
 *
 * @param {string} urlQueryParamsRaw
 * @return {Promise<void>}
 */
async function restoreFromUrl(urlQueryParamsRaw) {
	urlManager.setRawQuery(urlQueryParamsRaw);
	structure.setCurrent(urlManager.path);
	structure.historyAdd(structure.currentFolderItem);
	await loadStructure2(structure.currentFolderItem);

	if (urlManager.file) {
		const item = structure.getByPath(urlManager.file);
		if (item instanceof FileItem) {
			structure.selectorMove(item.index);
			structure.selectorSelect();
		}
	} else {
		mediaPopup.hide();
	}
}

/**
 * Url was changed by the user, for example by going back or forward. Back or forward button in browser, back button or
 * gesture on mobile device. In desktop browser it is even possible to jump multiple pages back at once.
 */
window.addEventListener('popstate', async function (event) {
	console.warn('popstate event', event);
	if (event.state === null) {
		return;
	}
	const queryParamsRaw = event.state.url.substring(1); // URL is in format `/?some=param` but we want only query parameters
	windowPopStateRunning = true; // Prevent pushing into history when browser is directing going back or forward.
	try {
		await restoreFromUrl(queryParamsRaw);
	} finally {
		windowPopStateRunning = false;
	}
});

urlManager.addEventListener('statechange', function (event) {
	console.warn('statechange event', event, event.detail.url);
	if (windowPopStateRunning === true) {
		console.debug('[UrlManager] statechange event: windowPopStateRunning is true, not pushing new history state.', event);
		return;
	}
	const url = event.detail.url;
	history.pushState({url: url}, '', url)
});

uploadPopup.addEventListener('uploadStart', function (event) {
	document.getElementById('navbar-upload-icon-progress').style.display = '';
});
uploadPopup.addEventListener('uploadDone', function (event) {
	document.getElementById('navbar-upload-icon-progress').style.display = 'none';
});

mediaPopup.addEventListener('beforeshowitem', function (event) {
	/** @var {FileItem} */
	const fileItem = event.detail.fileItem;
	urlManager.setFile(fileItem.path);
	document.activeElement.blur();
	setStatus(fileItem.getStatusLoadingText(Settings.load('compress')));
	structure.historyAdd(fileItem);
	structure.selectorMove(fileItem.index);
	$('html head title').text(fileItem.path + ' ☁ ' + $('html head title').data('original-title'));
	loadedStructure.mediaInfoCanvas.setItem(fileItem);
});
mediaPopup.addEventListener('itemloaddone', function (event) {
	setStatus(false);
});
mediaPopup.addEventListener('itemloaderror', function (event) {
	flashMessage('Chyba během načítání. Zkontroluj připojení k internetu a případně, kontaktuj autora.', 'danger', false);
	setStatus(false);
});

mediaPopup.addEventListener('afterhideitem', function (event) {
	structure.historyAdd(structure.currentFolderItem);
	urlManager.setFile(null);
});

function onMoveToNextOrPrevious(event, direction) {
	const movementResult = structure.selectorMove(direction);
	if (movementResult && mediaPopup.isActive()) {
		structure.selectorSelect();
	}
}

function onMoveToNextOrPreviousKeyboard(event, direction) {
	const key = event.detail.key;
	const moveBy = (key === 'ArrowUp' || key === 'ArrowDown') ? getTilesCount() : 1;

	let selectorMoved = false;
	for (let i = 0; i < moveBy; i++) {
		if (structure.selectorMove(direction) === false) {
			break;
		}
		selectorMoved = true;
	}

	if (selectorMoved && mediaPopup.isActive()) {
		structure.selectorSelect();
	}
}

mediaPopup.addEventListener('clickprevious', (event) => this.onMoveToNextOrPrevious(event, 'up'));
mediaPopup.addEventListener('clicknext', (event) => this.onMoveToNextOrPrevious(event, 'down'));

keyboardMapper.addEventListener('previous', (event) => this.onMoveToNextOrPreviousKeyboard(event, 'up'));
keyboardMapper.addEventListener('next', (event) => this.onMoveToNextOrPreviousKeyboard(event, 'down'));

const structureMap = new StructureMap('map', structure).init();
const browserMap = new BrowserMap('structure-browser-map', structure, serverApi).init();

structure.addEventListener('beforeselectormove', async function (event) {
	const newItem = event.detail.newItem;
	if (
		mediaPopup.isActive()
		&& (newItem?.isFile !== true)
	) {
		event.preventDefault();
		mediaPopup.wiggle();
		vibrateApi.vibrate(Settings.load('vibrationError'));
	}
});
structure.addEventListener('selectorselected', async function (event) {
	/** @type {Item|null} */
	const pathItem = event.detail.pathItem;

	if (pathItem.action) {
		await pathItem.run();
		return;
	}

	vibrateApi.vibrate(Settings.load('vibrationOk'));
	structure.historyAdd(pathItem);
	structure.setCurrent(pathItem.path);
	if (pathItem.isFolder) {
		await loadStructure2(pathItem);

		// Detect which file should be pre-selected
		let selectIndex = 0;
		const previousItem = structure.historyGet().last(2);
		if (previousItem instanceof FolderItem) {
			// Changing directory up (closer to the root) should match directory, that was selected previously
			// changing folder (item should always be something)
			// deeper - this will find "go back" folder
			// closer to root - this will find previously opened folder
			const item = structure.getByPath(previousItem.path);
			if (item) {
				structure.selectorMove(item.index);
			} else {
				structure.selectorMove(selectIndex);
			}
		}
	} else {
		mediaPopup.showFileItem(
			pathItem,
			structure.getPrevious(pathItem.index),
			structure.getNext(pathItem.index),
		);
	}
});

structure.addEventListener('directorychange', async function (event) {
	const newPath = event.detail.newPath;
	urlManager.setPath(newPath);

	if (browserMap.isHidden()) {
		return;
	}
	await browserMap.loadData(newPath);
})

browserMap.map.on('load moveend', async function (event) {
	if (structure.currentFolderItem === null) {
		return;
	}
	if (browserMap.isHidden()) {
		return;
	}
	await browserMap.loadData(structure.currentFolderItem);
});

window.addEventListener('beforeunload', function (event) {
	if (uploadPopup.isUploading) {
		event.preventDefault();
	}
});

/**
 * Global error handler
 * @author https://stackoverflow.com/a/10556743/3334403
 */
window.onerror = function (msg, url, line, col, error) {
	if (msg.match('ResizeObserver loop limit exceeded')) {
		// Dont care about this error: https://stackoverflow.com/questions/49384120/resizeobserver-loop-limit-exceeded
		return true;
	}
	// Note that col & error are new to the HTML 5 spec and may not be supported in every browser.  It worked for me in Chrome.
	let extra = !col ? '' : '\ncolumn: ' + col;
	extra += !error ? '' : '\nerror: ' + error;
	const text = "Error: " + msg + "\nurl: " + url + "\nline: " + line + extra;
	// Report and save error on server
	$.post('/api/report', {type: 'javascript', 'raw': text});

	// Error is caused by some external script, there is nothing that can be reported to the user
	// @HACK As of 2025-01-13 this error is occuring ALWAYS when page is loaded using Telegram Webview
	// @link https://github.com/DJTommek/pldr-gallery/issues/127
	if (msg === 'Script error.') {
		return true;
	}

	alert('Nastala neočekávaná chyba. Pokud se opakuje, udělej screenshot obrazovky a kontaktuj správce.\n' + text);
	// If you return true, then error alerts (like in older versions of Internet Explorer) will be suppressed.
	// return true;
};

class MediaInfoRenderer {
	static GROUP_GENERAL = 'General';
	static GROUP_LOCATION = 'Location';

	constructor(fileItem) {
		this.fileItem = fileItem;
		this.groups = {};
		this.groups[MediaInfoRenderer.GROUP_GENERAL] = {
			'Name': fileItem.text,
			'Path': fileItem.path,
			'Type': (fileItem.icon ? '<i class="fa fa-' + fileItem.icon + '"></i> ' : '') + fileItem.getTypeText(),
		};

		if (fileItem.size) {
			this.groups[MediaInfoRenderer.GROUP_GENERAL]['Size'] = formatBytes(fileItem.size, 2);
		}

		if (fileItem.created) {
			this.groups[MediaInfoRenderer.GROUP_GENERAL]['Created'] = fileItem.created.human(true).toString2() + ' (' + fileItem.created.agoHuman(true) + ' ago)';
		}

		if (fileItem.coords) {
			const coordsStr = fileItem.coords.toString();
			this.addInfo(
				MediaInfoRenderer.GROUP_LOCATION,
				'Coordinates',
				'<a href="https://better-location.palider.cz/' + coordsStr + '" target="_blank">' + coordsStr + '</a>'
			);
		}
	}

	addInfo(group, name, value) {
		if (group in this.groups === false) {
			this.groups[group] = {};
		}
		this.groups[group][name] = value;
	}

	/**
	 * @return {string}
	 */
	renderHtml() {
		let mediaInfoHtml = '<table class="table">';
		for (const groupName in this.groups) {
			if (groupName !== MediaInfoRenderer.GROUP_GENERAL) {
				mediaInfoHtml += '<tr><td colspan="2" class="media-info-group-name">' + groupName + '</td></tr>';
			}
			const group = this.groups[groupName];
			for (const mediaInfoName in group) {
				const mediaInfoValue = group[mediaInfoName];
				mediaInfoHtml += '<tr>';
				mediaInfoHtml += '<td>' + mediaInfoName + '</td>';
				mediaInfoHtml += '<td>' + mediaInfoValue + '</td>';
				mediaInfoHtml += '</tr>';
			}
		}
		mediaInfoHtml += '</table>';
		return mediaInfoHtml;
	}
}

class MediaDetailsCanvas {
	constructor() {
		this.item = null;
		this.elementId = 'popup-media-details';
		this.element = document.getElementById(this.elementId);
		this.bootstrapInstance = bootstrap.Offcanvas.getOrCreateInstance(this.element);

		this.element.addEventListener('show.bs.offcanvas', function (event) {
			vibrateApi.vibrate(Settings.load('vibrationOk'));
		});
		this.element.addEventListener('hide.bs.offcanvas', function (event) {
			vibrateApi.vibrate(Settings.load('vibrationOk'));
		});
	}

	/**
	 * @param {FileItem} item
	 */
	setItem(item) {
		this.item = item;
		this.render();
		return this;
	}

	render() {
		const mediaInfoRenderer = new MediaInfoRenderer(this.item);
		$('#' + this.elementId + ' .data').html(mediaInfoRenderer.renderHtml());
		return this;
	}

	/**
	 * @return {boolean}
	 */
	isShown() {
		return this.bootstrapInstance._isShown;
	}

	show() {
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		this.bootstrapInstance.show();
		return this;
	}

	hide() {
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		this.bootstrapInstance.hide();
		return this;
	}
}

/**
 * Webpage loading is done
 */
$(async function () {
	updateLoginButtons();

	// Save original title into data property
	$('html head title').data('original-title', $('html head title').text());

	loadedStructure.mediaInfoCanvas = new MediaDetailsCanvas();

	$('#button-logout').on('click', function (event) {
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		if (confirm('Opravdu se chceš odhlásit?') === false) {
			event.preventDefault();
		}
	});

	const advancedSearchFormEl = document.getElementById('advanced-search-form');
	advancedSearchFormEl.addEventListener('show.bs.collapse', function (event) {
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		structure.showSearchActions(true, structure.getCurrentFolder().isRoot() === false);
	});
	advancedSearchFormEl.addEventListener('hide.bs.collapse', function (event) {
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		const filterTextEmpty = $('#structure-search input').val() === '';
		structure.showSearchActions(
			filterTextEmpty === false,
			filterTextEmpty === false && structure.getCurrentFolder().isRoot() === false,
		);
	});

	if (CONFIG.archive.enabled === false) {
		$('#navbar-download-archive').parent().remove();
	}

	loadUserData();

	// Event - swipe in popup
	// @TODO not detecting if swipe starts in different DOM than defined (eg. #status)
	// $('#popup-content').swipeDetector()
	// 	.on('swipeLeft.sd', () => mediaPopup.elementNext.click())
	// 	.on('swipeRight.sd', () => mediaPopup.elementPrev.click())
	// 	.on('swipeDown.sd', () => mediaPopup.hide())
	// 	.on('swipeUp.sd', () => loadedStructure.mediaInfoCanvas.show());

	// Event - swipe in popup media details
	// $('#popup-media-details').swipeDetector()
	// 	.on('swipeRight.sd', () => loadedStructure.mediaInfoCanvas.hide())

	/**
	 * Advanced search file size slider
	 */
	(function () {
		const sizeSliderWrapEl = document.getElementById('advanced-search-size-wrap');
		if (FILE_SIZE_PERCENTILES !== null) { // show slider (default is hidden)
			sizeSliderWrapEl.style.display = '';
			// Inicialize slider
			const sizeSliderEl = document.getElementById('advanced-search-size');
			const sizeMinEl = document.getElementById('advanced-search-size-min');
			const sizeMaxEl = document.getElementById('advanced-search-size-max');

			const fileSizePercMin = FILE_SIZE_PERCENTILES[0];
			const fileSizePercMax = FILE_SIZE_PERCENTILES[FILE_SIZE_PERCENTILES.length - 1];

			const range = {};
			for (const data of FILE_SIZE_PERCENTILES) {
				if (data.percent === 0) {
					range['min'] = 0 // override to show 0 in slider instead of smallest file;
				} else if (data.percent === 1) {
					range['max'] = data.fileSize;
				} else {
					const key = (data.percent * 100) + '%';
					range[key] = data.fileSize;
				}
			}

			noUiSlider.create(sizeSliderEl, {
				start: [0, fileSizePercMax.fileSize],
				connect: true,
				tooltips: false,
				pips: {
					mode: 'count',
					values: 6,
					density: 12,
					format: {
						to: function (val) {
							return formatBytes(val);
						},
					},
				},
				range: range,
			});

			// Initial values in form
			sizeMinEl.textContent = formatBytes(fileSizePercMin.fileSize);
			sizeMaxEl.textContent = formatBytes(fileSizePercMax.fileSize);

			sizeSliderEl.noUiSlider.on('update', function () {
				const [min, max] = sizeSliderEl.noUiSlider.get(true);
				sizeMinEl.textContent = formatBytes(min);
				sizeMaxEl.textContent = formatBytes(max);
			});
		}
	})();

	/**
	 * Initialize UI for upload files to the server using Filepond.
	 */
	(function () {
		FilePond.registerPlugin(FilePondPluginFileValidateSize);
		FilePond.registerPlugin(FilePondPluginFileValidateType);
		const filePond = FilePond.create(document.getElementById('upload-modal-form-files'));
		uploadPopup.init(filePond);
		/**
		 * @HACK how to access responses from server API in label to render proper error message. Probably it might
		 *       behave weird due to race conditions. Also in some cases FilePond library does not reads response body
		 *       so we must show default error instead.
		 * @see https://github.com/pqina/vue-filepond/issues/41#issuecomment-840237085
		 */
		const serverErrorMessageDefault = 'try again later'
		let serverErrorMessage = serverErrorMessageDefault;

		const acceptedFileTypes = [];
		for (const allowedExtension of CONFIG.upload.allowedExtensions) {
			const mediaType = FileExtensionMapperInstance.getMediaType(allowedExtension);
			if (mediaType === null) {
				continue;
			}
			acceptedFileTypes.push(mediaType);
		}

		uploadPopup.filePond.setOptions({
			server: {
				url: '/api/upload',
				process: {
					onerror: (responseBody) => {
						try {
							serverErrorMessage = JSON.parse(responseBody).message;
						} catch (error) {
							serverErrorMessage = serverErrorMessageDefault;
						}
					}
				},
				headers: {
					'Accept': 'application/json',
				}
			},
			allowRevert: false, // @TODO disabled because server is currently not supporting

			// Config related to chunk uploading
			chunkUploads: true,
			 // When chunk upload is forced, then first request is just form, without file itself. During this request
			// it is being checked, if user can upload this file in this directory, without wasting resources.
			chunkForce: true,
			chunkSize: CONFIG.upload.uploadChunkSize,

			// Config related to file size validation
			allowFileSizeValidation: true,
			minFileSize: 1,
			maxFileSize: CONFIG.upload.fileMaxSize,

			// Config related to file type validation
			allowFileTypeValidation: true,
			acceptedFileTypes: acceptedFileTypes,
			fileValidateTypeDetectType: function (file, mimeType) {
				return new Promise((resolve, reject) => {
					if (mimeType !== '') {
						return resolve(mimeType);
					}

					const fileExt = file.name.split('.').pop().toLowerCase();
					const extData = FileExtensionMapperInstance.getMediaType(fileExt);
					extData === null ? reject() : resolve(extData);
				});
			},

			labelFileProcessingError: () => {
				const result = '⚠️Error: ' + serverErrorMessage;
				serverErrorMessage = serverErrorMessageDefault;
				return result;

			},
			oninitfile: function (event) {
				event.setMetadata('path', structure.currentFolderItem.getEncodedPath());
				event.setMetadata('name', event.file.name);
			},
		});
	})();

	// Load and set type of view from Settings
	structureViewChange(Settings.load('structureDisplayType'));

	// Event - changed type of tiles view
	$('#structure-display-type button').on('click', function () {
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		structureViewChange($(this).find('input').val());
	});

	// Event - clicked on archive download
	$('#navbar-download-archive').on('click', function (event) {
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		if (confirm('Opravdu chceš stáhnout obsah této složky i všech podsložek jako ZIP?') === false) {
			event.preventDefault();
		}
	});

	// Event - selected item in structure
	$('#structure').on('click', '.structure-item', function (event) {
		if ($(event.target).closest('.location').length !== 0) {
			return; // do not select in structure, just open link
		}
		event.preventDefault();
		const itemIndex = $(this).data('index');
		structure.selectorMove(itemIndex);
		structure.selectorSelect();
	});

	/**
	 * set compress variable into cookie on page load
	 */
	if (Settings.load('compress') === true) {
		Cookies.set('pmg-compress', true);
	} else {
		Cookies.remove('pmg-compress');
	}

	$('#navbar').on('click', '#navbar-share', async function (event) { // Event - share URL
		event.preventDefault();
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		await shareItem(structure.getCurrentFolder());
	});

	// Event - share file url from popup
	$('#popup-media-details-share').on('click', async function (event) {
		event.preventDefault();
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		await shareItem(structure.getCurrentFile());
	});

	$(document).on('click', '.copy-to-clipboard', function () {
		const textToCopy = $(this).data('to-copy');
		if (copyToClipboard(textToCopy)) {
			vibrateApi.vibrate(Settings.load('vibrationOk'));
			flashMessage('Text "<b>' + textToCopy + '</b>" was copied to clipboard.')
		} else {
			// noinspection JSJQueryEfficiency - delete previous flash error message (if any) before showing new
			$('#copy-to-clipboard-flash').parent().remove();
			// show error with pre-selected input filled with URL
			flashMessage('<p><b>Error</b> while copying text to clipboard, copy it manually via <kbd class="nobr"><kbd>CTRL</kbd> + <kbd>C</kbd></kbd></p><input id="copy-to-clipboard-flash" type="text" value="' + textToCopy + '">', 'danger', false);
			// noinspection JSJQueryEfficiency
			$('#copy-to-clipboard-flash').trigger('focus').trigger('select');
		}
	}).on('click', '#map-info-window .item-share', async function (event) {
		event.preventDefault();
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		const itemIndex = $('#map-info-window').data('item-index');
		await shareItem(structure.getFile(itemIndex));
	}).on('click', '#navbar .breadcrumb-item', async function (event) {
		event.preventDefault();
		const path = $(this)[0].dataset.path;
		const folderItem = new FolderItem(null, {path: path});
		structure.historyAdd(folderItem);
		structure.setCurrent(folderItem.path);

		await loadStructure2(folderItem);
		vibrateApi.vibrate(Settings.load('vibrationOk'));
	}).on('click', '#user-logged-in', function (event) {
		vibrateApi.vibrate(Settings.load('vibrationOk'));
	}).on('click', '#user-logged-out', function (event) {
		vibrateApi.vibrate(Settings.load('vibrationOk'));
	}).on('click', '#map-info-window .open-media-popup', function (event) {
		event.preventDefault();
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		const itemIndex = $('#map-info-window').data('item-index');
		structure.selectorMove(itemIndex);
		structure.selectorSelect();
	}).on('click', '#map-info-window .open-media-info', function (event) {
		event.preventDefault();
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		const itemIndex = $('#map-info-window').data('item-index');
		const item = structure.getItem(itemIndex);
		loadedStructure.mediaInfoCanvas.setItem(item).show();
	}).on('mouseenter', '.structure-item', function () {
		loadedStructure.hoveredStructureItemElement = $(this);
	}).on('mouseleave', '.structure-item', function () {
		loadedStructure.hoveredStructureItemElement = null;
	});

	// Backward compatibility: convert old hash format into new query parameter format
	let restoreParams = window.location.search;
	if (restoreParams === '' && window.location.hash !== '') {
		const path = window.location.hash.substring(1);
		if (path.endsWith('/')) {
			restoreParams = '?path=' + path;
		} else {
			restoreParams = '?file=' + path;
		}
		console.log('Old URL in hash format detected, converted "' + path + '" into "' + restoreParams + '"');
	}

	await restoreFromUrl(restoreParams);
});

function mapInfoWindowImageLoaded() {
	$('#map-info-window .thumbnail-not-loaded').removeClass('thumbnail-not-loaded').show();
	$('#map-info-window .thumbnail-loading-icon').remove();
}

function mapInfoWindowImageError() {
	$('#map-info-window .thumbnail-loading-icon').removeClass('fa-circle-o-notch fa-spin').addClass('fa-' + Icon.IMAGE);
}

function updateLoginButtons() {
	if (Cookies.get('google-login')) { // logged in
		$('#user-logged-in').show();
		$('#user-logged-out').hide();
		$('#dynamic-styles').text('.logged-in {display: inherit;} .logged-out {display: none;}');
	} else {
		$('#user-logged-in').hide();
		$('#user-logged-out').show();
		$('#dynamic-styles').text('.logged-out {display: inherit;} .logged-in {display: none;}');
	}
}

function loadUserData() {
	// Load info about user
	$.ajax({
		url: '/api/user',
		method: 'GET',
		success: function (result) {
			if (result.error === false) {
				const user = result.result;
				loadedStructure.user = user;
				const $userPicture = $('#user-picture');
				if (user && user.picture) {
					$userPicture.attr('src', user.picture);
				}
				$userPicture.show()
				$('#user-picture-icon').remove();
			}
		}
	});
}

/**
 *
 * @param {FolderItem} directoryItem
 * @return {Promise<void>}
 */
async function loadSearch(directoryItem = null) {
	const params = new URLSearchParams();
	params.set('path', directoryItem.getEncodedPath());
	params.set('sort', $('#advanced-search-sort input[name=sort]:checked').val());

	let query = $('#structure-search-input').val().trim();
	if (query) {
		params.set('query', query);
	}

	const slider = document.getElementById('advanced-search-size');
	if (slider.noUiSlider) { // slider might not be available (eg. no scanned files with size)
		const [sizeMin, sizeMax] = slider.noUiSlider.get(true);
		if (sizeMin !== 0) { // Send sizeMin only if higher than zero
			params.set('sizeMin', Math.floor(sizeMin));
		}
		if (sizeMax !== FILE_SIZE_PERCENTILES[FILE_SIZE_PERCENTILES.length - 1].fileSize) {
			// Send sizeMax only if not equals to biggest file available
			params.set('sizeMax', Math.ceil(sizeMax));
		}
	}

	loadingStructure(directoryItem);
	$('#structure-search .search i.fa').addClass('fa-circle-o-notch fa-spin').removeClass('fa-search');
	try {
		const result = await serverApi.search(params);
		parseStructure(result.result);
		structure.selectorMove('first');
		structureMap.markersFromStructureFiles(structure.getFiles());
		structure.filter();
		loadThumbnail();
	} catch (error) {
		flashMessage(`Searching in <b>${directoryItem.path.escapeHtml()}</b> failed:<br>${error.message.escapeHtml()}`, 'danger', false);
	} finally {
		loadingStructure(false);
		$('#structure-search .search i.fa').removeClass('fa-circle-o-notch fa-spin').addClass('fa-search');
	}
}

/**
 * Trigger loading thumbnails based on priority.
 *
 * This function should be called every time there are at least one new thumbnail image, that should be loaded. Should
 * be called only once, function will automatically handle loading even multiple of thumbnails at once.
 *
 * Native `loading=lazy` is not used, because it is missing loading images based on priority. Also native lazyload
 * works differently by not loading thumbnails, that are not in viewport.
 */
function loadThumbnail() {
	const thumbnailsLoadingCountMax = 25;
	const thumbnailsLoadingCountCurrent = $('.thumbnail-loading-icon').length;

	if (thumbnailsLoadingCountCurrent > thumbnailsLoadingCountMax) {
		return; // Already loading too many thumbnails.
	}

	const thumbnailsNotLoaded = $('.thumbnail-not-loaded:not(.thumbnail-loading):visible');
	if (thumbnailsNotLoaded.length === 0) {
		return; // All thumbnails are already loaded.
	}

	let thumbnailToLoad = null;

	// prioritize items, that are hovered with mouse
	if (loadedStructure.hoveredStructureItemElement) {
		const hoveredItemThumbnail = loadedStructure.hoveredStructureItemElement.children('.thumbnail');
		if (hoveredItemThumbnail.hasClass('thumbnail-not-loaded') && hoveredItemThumbnail.hasClass('thumbnail-loading') === false) {
			thumbnailToLoad = hoveredItemThumbnail;
		}
	}

	// prioritize items, that are selected in structure
	if (thumbnailToLoad === null) {
		const selectedItemThumbnail = $('.item-index-' + structure.selectedIndex).children('.thumbnail');
		if (selectedItemThumbnail.hasClass('thumbnail-not-loaded') && selectedItemThumbnail.hasClass('thumbnail-loading') === false) {
			thumbnailToLoad = selectedItemThumbnail;
		}
	}

	if (thumbnailToLoad === null) {
		// prioritize items, that are visible in viewport
		const visibleThumbnailsToLoad = thumbnailsNotLoaded.filter(function () {
			return isElementInView(this, true);
		});
		if (visibleThumbnailsToLoad.length > 0) {
			thumbnailToLoad = visibleThumbnailsToLoad.first();
		} else {
			// no priority, load first available non-loaded thumbnail
			thumbnailToLoad = thumbnailsNotLoaded.first();
		}
	}

	thumbnailToLoad.addClass('thumbnail-loading');
	const firstThumbnailParent = thumbnailToLoad.parent();
	// @TODO save new generated DOM and use .remove() directly instead of find()
	thumbnailToLoad.before('<i class="thumbnail-loading-icon fa fa-circle-o-notch fa-spin" title="Loading thumbnail..."></i>');
	// trigger loading image after new src is loaded
	// @Author https://stackoverflow.com/a/7439093/3334403 (http://jsfiddle.net/jfriend00/hmP5M/)
	thumbnailToLoad.one('load error', function () {
		firstThumbnailParent.find('i.thumbnail-loading-icon').remove();
		thumbnailToLoad.removeClass('thumbnail-not-loaded').removeClass('thumbnail-loading');
		loadThumbnail();
	}).attr('src', thumbnailToLoad.data('src'));
	loadThumbnail();
}

/**
 *
 * @param {FolderItem} directoryItem
 * @return {Promise<void>}
 */
async function loadStructure2(directoryItem) {
	try {
		loadingStructure(directoryItem);
		let result;
		try {
			result = await serverApi.structure(directoryItem);
		} catch (error) {
			flashMessage(`Loading structure <b>${directoryItem.path.escapeHtml()}</b> failed:<br>${error.message.escapeHtml()}`, 'danger', false);
			return;
		}
		$('#structure-header').html(result.result.header || '');
		$('#structure-footer').html(result.result.footer || '');
		parseStructure(result.result);
		$('#structure-search input').val('');
		loadThumbnail();
		structure.filter();
		$('#navbar-upload').toggle(result.result.canWrite);
	} finally {
		loadingStructure(false);
	}
}

function parseStructure(items) {
	// in case of triggering loading the same structure again (already loaded), skip it
	updateLoginButtons(); // might be logged out

	structure.setAll(items);
	const currentFolder = structure.getCurrentFolder();

	/** Generate breadcrumb urls in menu */
	let breadcrumbHtml = '';
	breadcrumbHtml += '<li class="breadcrumb-item" data-path="/"><a href="' + urlManager.withPath('/') + '" title="Go to root folder"><i class="fa fa-home"></i></a></li>';
	for (let i = 1; i <= currentFolder.paths.length; i++) {
		const pathChunks = currentFolder.paths.slice(0, i);
		const directoryName = pathChunks.last();
		const breadcrumbPath = '/' + pathChunks.join('/') + '/';
		breadcrumbHtml += '<li class="breadcrumb-item" data-path="' + breadcrumbPath + '"><a href="' + urlManager.withPath(breadcrumbPath) + '">' + directoryName + '</a></li>';
	}
	$('#currentPath').html(breadcrumbHtml);

	let maxVisible = structure.getItems().length;
	$('#navbar-download-archive').attr('href', structure.getCurrentFolder().getArchiveUrl());

	/**
	 * Generate structure content
	 */
	let contentTiles = '';

	structure.getActions().forEach(function (item) {
		if (item.noFilter) {
			maxVisible--;
		}
		const itemStyle = item.hide ? 'style="display: none;"' : '';
		contentTiles += '<span class="structure-item item-index-' + item.index + '" data-index="' + item.index + '" ' + itemStyle + '>';
		contentTiles += ' <i class="fa fa-' + item.icon + ' fa-fw icon"></i>';
		contentTiles += ' <img class="thumbnail" src="' + transparentPixelBase64 + '">'; // fake thumbnail for proper display
		contentTiles += ' <a class="name" href="#">' + item.text + '</a>';
		contentTiles += '</span>';
	});

	for (const directoryItem of structure.getFolders()) {
		if (directoryItem.noFilter) {
			maxVisible--;
		}
		contentTiles += '<span class="structure-item item-index-' + directoryItem.index + '" data-index="' + directoryItem.index + '">';
		contentTiles += ' <i class="fa fa-' + directoryItem.icon + ' fa-fw icon"></i>';
		if (!directoryItem.noFilter && CONFIG.thumbnails.folder.enabled === true) {
			contentTiles += ' <img class="thumbnail thumbnail-not-loaded" src="' + transparentPixelBase64 + '" data-src="' + directoryItem.getThumbnailUrl() + '">';
		} else {
			contentTiles += ' <img class="thumbnail" src="' + transparentPixelBase64 + '">'; // fake thumbnail for proper display
		}
		contentTiles += ' <a class="name" href="' + urlManager.withPath(directoryItem.path) + '">' + directoryItem.text + '</a>';
		if (directoryItem.created) {
			const created = directoryItem.created.human(true);
			contentTiles += ' <span class="created" title="' + created + ' (' + msToHuman(Math.max(new Date().getTime() - directoryItem.created, 0)) + ' ago)">' + created.date + ' <span>' + created.time + '</span></span>';
		}
		contentTiles += '</span>';
	}

	if (items.foldersTotal > items.folders.length) {
		const text = 'Celkem je zde ' + (items.foldersTotal) + ' složek ale z důvodu rychlosti jsou některé skryty. Limit můžeš ovlivnit v nastavení.';
		contentTiles += '<span class="structure-item">';
		contentTiles += ' <i class="icon fa fa-info fa-fw"></i>';
		contentTiles += ' <img class="thumbnail" src="' + transparentPixelBase64 + '">'; // fake thumbnail for proper display
		contentTiles += ' <span class="name">' + text + '</span>';
		contentTiles += '</span>';
	}

	for (const fileItem of structure.getFiles()) {
		contentTiles += '<span class="structure-item item-index-' + fileItem.index + '" data-index="' + fileItem.index + '">';
		contentTiles += ' <i class="icon fa fa-' + fileItem.icon + ' fa-fw"></i>';

		const thumbnailUrl = fileItem.getThumbnailUrl();
		const thumbnailEnabled = (
			(fileItem.isImage && CONFIG.thumbnails.image.enabled)
			|| (fileItem.isVideo && CONFIG.thumbnails.video.enabled)
		)
		if (thumbnailEnabled && thumbnailUrl) {
			contentTiles += ' <img class="thumbnail thumbnail-not-loaded" src="' + transparentPixelBase64 + '" data-src="' + thumbnailUrl + '">';
		} else {
			contentTiles += ' <img class="thumbnail" src="' + transparentPixelBase64 + '">'; // fake thumbnail for proper display
		}

		contentTiles += ' <a href="' + urlManager.withFile(fileItem.path) + '" class="name">' + fileItem.text + '</a>';

		if (fileItem.distance) {
			contentTiles += ' <span class="distance">' + formatDistance(fileItem.distance) + '</span>';
		}
		if (fileItem.coords) {
			contentTiles += ' <a href="https://better-location.palider.cz/' + fileItem.coords + '" class="location" target="_blank" title="Open coordinates ' + fileItem.coords + ' in Better Location"><i class="fa fa-map-marker"></i></a>';
		}
		if (fileItem.size !== null) {
			contentTiles += ' <span class="size">' + formatBytes(fileItem.size, 2) + '</span>';
		}
		if (fileItem.created) {
			const created = fileItem.created.human(true);
			contentTiles += ' <span class="created" title="' + created + ' (' + msToHuman(Math.max(new Date().getTime() - fileItem.created, 0)) + ' ago)">' + created.date + ' <span>' + created.time + '</span></span>';
		}
		contentTiles += '</span>';
	}

	if (maxVisible === 0) {
		contentTiles += '<span class="structure-item">';
		contentTiles += ' <i class="icon fa fa-info fa-fw"></i>';
		contentTiles += ' <img class="thumbnail" src="' + transparentPixelBase64 + '">'; // fake thumbnail for proper display
		contentTiles += ' <span class="name">Složka je prázdná.</span>';
		contentTiles += '</span>';
	} else { // @TODO quick workaround, should be available all the time and toggled visibilty in filter
		contentTiles += '<span class="structure-item" id="filter-structure-empty" style="display: none;">';
		contentTiles += ' <i class="icon fa fa-warning fa-fw"></i>';
		contentTiles += ' <img class="thumbnail" src="' + transparentPixelBase64 + '">'; // fake thumbnail for proper display
		contentTiles += ' <span class="name">Zadanému filtru nevyhovuje žádná složka ani soubor.</span>';
		contentTiles += '</span>';
	}
	if (items.filesTotal > items.files.length) {
		contentTiles += '<span class="structure-item">';
		contentTiles += ' <i class="icon fa fa-info fa-fw"></i>';
		contentTiles += ' <img class="thumbnail" src="' + transparentPixelBase64 + '">'; // fake thumbnail for proper display
		contentTiles += ' <span class="name">Celkem je zde ' + (items.filesTotal) + ' souborů ale z důvodu rychlosti jsou některé skryty. Limit můžeš ovlivnit v nastavení.</span>';
		contentTiles += '</span>';
	}
	$('#structure-tiles').html(contentTiles);
	$('#structure-search .total').text(maxVisible);
	$('#structure-search .filtered').text(maxVisible);
}

/**
 *
 * @param {FolderItem|false} directoryItem
 */
function loadingStructure(directoryItem) {
	if (directoryItem) {
		// add loading icon to specific item in structure
		$('#structure-search .filtered').html('<i class="fa fa-circle-o-notch fa-spin"></i>');
		$('#structure-search .total').html('<i class="fa fa-circle-o-notch fa-spin"></i>');
		$('#structure-search input').prop('disabled', true);
		$('#structure-search .search').prop('disabled', true);
		// @TODO set different message if searching
		setStatus('Loading folder "<span title="' + directoryItem.text + '">' + directoryItem.text + '</span>"');
		return;
	}

	setStatus(false);
	$('#structure-search input').prop('disabled', false);
	$('#structure-search .search').prop('disabled', false);

	// Event - thumbnail can't be loaded, destroy that element
	// @FIXME this handler should be created only once (on page load) instead on every structure load but for some reason it don't work
	$('#structure .structure-item img.thumbnail').on('error', function () {
		this.remove();
	});
}

/**
 * Set status loading message.
 *
 * @param {boolean|string} message - false to disable or string to enable
 */
function setStatus(message) {
	if (message === false) {
		loadedStructure.loading = false;
		$('#status').hide();
	} else {
		loadedStructure.loading = true;
		$('#status').show();
		$('#status-text').html(message);
	}
	return loadedStructure.loading;
}

/**
 * Show flash message on the top of the screen
 *
 * @param {string} text Content of flash message
 * @param {string} [type] format of message based on Bootstrap predefined colors (info, warning, danger, primary etc)
 * @param {number|boolean} [fade] hide message after x miliseconds. False to disable auto-hide
 * @param {jQuery.selector} [target] generated message will appendTo() this element
 */
function flashMessage(text, type = 'info', fade = 4000, target = '#flash-message') {
	const currentFlashId = loadedStructure.flashIndex++
	let html = '<div class="alert alert-' + type + ' fade show alert-dismissible" id="alert-' + currentFlashId + '" role="alert">';
	html += '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>';
	const now = new Date();
	html += '<p class="datetime" title="' + now.human() + '">' + now.human(true).time + ' <span class="badge bg-danger" style="display: none">New</span></p>';
	html += '<p class="content">' + text + '</p>';
	html += '</div>';
	$(target).prepend(html);
	if ($(target + ' > div').length > 1) { // if at least one alert is visible, add "new" tag to newly created alert
		$(target + ' > div .badge').hide();
		$(target + ' > div .badge').first().show();
	}
	if (fade !== false) {
		setTimeout(function () {
			$('#alert-' + currentFlashId).alert('close');
		}, fade);
	}
}

/**
 * Prompt share on user's device. Try to copy to clipboard if native browser sharing is not possible
 *
 * @param {FolderItem|FileItem} item
 */
async function shareItem(item) {
	let niceUrl = window.location.origin;
	if (item.isFolder) {
		niceUrl += urlManager.withPath(item.path);
	} else if (item.isFile) {
		niceUrl += urlManager.withFile(item.path);
	} else {
		throw new Error('Item type is not supported.');
	}

	if (navigator.canShare !== undefined) {
		const shareData = {
			title: item.text,
			text: item.path,
			url: niceUrl,
		};
		if (navigator.canShare(shareData)) {
			try {
				await navigator.share(shareData);
				return;
			} catch (error) {
				// Ignore, continue with fallback
			}
		}
	}

	// Fallback to "Copy to clipboard"
	// @TODO probably is not working in Chrome DevTools mobile device emulator
	if (copyToClipboard(niceUrl)) {
		flashMessage('URL was copied to clipboard.')
	} else {
		// noinspection JSJQueryEfficiency - delete previous flash error message (if any) before showing new
		$('#breadcrumb-share-flash').parent().remove();
		// show error with pre-selected input filled with URL
		flashMessage('<p><b>Error</b> while copying URL, copy it manually via <kbd class="nobr"><kbd>CTRL</kbd> + <kbd>C</kbd></kbd></p><input id="breadcrumb-share-flash" type="text" value="' + niceUrl + '">', 'danger', false);
		// noinspection JSJQueryEfficiency
		$('#breadcrumb-share-flash').trigger('focus').trigger('select');
	}
}

function structureViewChange(value) {
	// Get list of possible view types from HTML
	const allowedValues = [];
	$('#structure-display-type input[type=radio]').each(function () {
		allowedValues.push($(this).val());
	})

	// Force set to default view if invalid type detected
	if (allowedValues.includes(value) === false) {
		value = allowedValues[0];
	}

	Settings.save('structureDisplayType', value);
	// reset original values
	$('#structure-display-type button').removeClass('btn-secondary').addClass('btn-outline-secondary');

	// update all necessary data depending on choosen tile-size
	$('#structure-tiles').removeClass().addClass(value);

	// set new values
	$('#structure-display-type-' + value).removeClass('btn-outline-secondary').addClass('btn-secondary');
	// check radiobox
	$('#structure-display-type-' + value + ' input').attr('checked', true);

	if (value === 'map') {
		$('#structure-tiles').hide();
		$('#structure-search').hide();
		browserMap.mapShow();
		if (structure.currentFolderItem !== null) {
			// Structure is probably still loading, brwoser map data loader will be triggered later.
			browserMap.loadData(structure.currentFolderItem);
		}
	} else {
		$('#structure-tiles').show();
		$('#structure-search').show();
		browserMap.mapHide();
	}

	// start loading thumbnails
	loadThumbnail();
}

/**
 * Calculate how many tiles are on one row.
 *
 * @author https://stackoverflow.com/a/11539490/3334403
 */
function getTilesCount() {
	let tilesInRow = 0;
	let selector = '#structure-tiles .structure-item';
	$(selector).each(function () {
		const $this = $(this);
		const $thisPrev = $this.prev();
		if ($thisPrev.length > 0) {
			if ($this.is(':hidden') || $thisPrev.is(':hidden')) {
				return;
			}

			// Position top is not calculating with eventual border (if item is selected or hover over). In that case position
			// of element is a little bit lower than others even on same line (according tests it should be less than pixel)
			if (Math.ceil($this.position().top) !== Math.ceil($thisPrev.position().top)) {
				return false;
			}
			tilesInRow++;
		} else {
			tilesInRow++;
		}
	});
	return tilesInRow;
}

function isTilesView() {
	return (Settings.load('structureDisplayType').includes('tiles'));
}
