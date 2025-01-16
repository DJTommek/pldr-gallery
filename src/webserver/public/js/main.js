/* global Settings */
const loadedStructure = {
	loadedFolder: '', // default is loaded nothing
	popup: false, // Is popup visible?
	settings: false, // is settings modal visible?
	mediaInfoCanvas: null, // MediaDetailsCanvas instance
	advancedSearchModal: false, // is advanced search modal visible?
	filtering: false,
	flashIndex: 0, // incremental index used for flashMessage()
	request: null, // AJAX request structure object
	hoveredStructureItemElement: null,
	user: null,
};
const transparentPixelBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII';

const structure = new Structure();
const presentation = new Presentation();
const vibrateApi = new VibrateApi();

const structureMap = new StructureMap('map', structure).init();
const advancedSearchMap = new AdvancedSearchMap('advanced-search-map').init();
const structureBrowserMap = new BrowserMap('structure-browser-map', structure).init();

advancedSearchMap.map.on('click', function (event) {
	vibrateApi.vibrate(Settings.load('vibrationOk'));
	advancedSearchMap.setMarker(event.latlng);
	const coords = new Coordinates(event.latlng.lat.toFixed(6), event.latlng.lng.toFixed(6));
	$('#advanced-search-coords')
		.text(coords.toString())
		.attr('href', 'https://better-location.palider.cz/' + coords.toString())
		.data({lat: coords.lat, lon: coords.lon})
		.show();
});

function loadingDone(element) {
	if (element) {
		$(element).fadeIn(Settings.load('animationSpeed'), function () {
			setStatus(false);
		});
		if ($(element).is('video')) {
			if (presentation.running) { // presentation is enabled
				videoPlay();
			}
		} else if ($(element).is('audio')) {
			if (presentation.running) { // presentation is enabled
				audioPlay();
			}
		} else if ($(element).is('img')) {
			if (presentation.running) { // presentation is enabled
				const duration = Settings.load('presentationSpeed');
				$('#popup-presentation-progress').css('transition', 'width ' + duration + 'ms linear');
				$('#popup-presentation-progress').css('width', '0%');
				// Load next item after presentation timeout.
				presentation.intervalId = setTimeout(function () {
					presentation.next();
				}, duration);
			}
		}
	} else {
		setStatus(false);
	}
}

/**
 * Shortcuts to proper handling moving between items if popup is opened (respect presentation mode)
 */
function itemPrev10(stopPresentation) {
	for (let i = 0; i < 9; i++) { // only 9 times. 10th time is in itemPrev()
		structure.selectorMove('up');
	}
	itemPrev(stopPresentation);
}

function itemPrev(stopPresentation) {
	if (stopPresentation === true) {
		presentation.stop();
	}
	presentation.clearTimeout(); // to prevent running multiple presentation timeouts at the same time
	videoPause();
	audioPause();
	const currentFileIndex = structure.selectedIndex;
	structure.selectorMove('up');
	// if new selected item is not file, select first file and show it
	if (structure.getItem(structure.selectedIndex).isFile === false) {
		structure.selectorMove(structure.getFirstFile().index);
	}
	structure.selectorSelect();
	// do wiggle animation if there is no item to move to
	if (currentFileIndex === structure.selectedIndex) {
		vibrateApi.vibrate(Settings.load('vibrationError'));
		$('#popup-content').addClass('wiggle');
		setTimeout(function () {
			$('#popup-content').removeClass('wiggle');
		}, 500);
	} else {
		vibrateApi.vibrate(Settings.load('vibrationOk'));
	}
}

function itemNext(stopPresentation) {
	if (stopPresentation === true) {
		presentation.stop();
	}
	presentation.clearTimeout(); // to prevent running multiple presentation timeouts at the same time
	videoPause();
	audioPause();
	const currentFileIndex = structure.selectedIndex;
	structure.selectorMove('down');
	structure.selectorSelect();
	// do wiggle animation if there is no item to move to
	if (currentFileIndex === structure.selectedIndex) {
		vibrateApi.vibrate(Settings.load('vibrationError'));
		$('#popup-content').addClass('wiggle');
		setTimeout(function () {
			$('#popup-content').removeClass('wiggle');
		}, 1000);
	} else {
		vibrateApi.vibrate(Settings.load('vibrationOk'));
	}
}

function itemNext10(stopPresentation) {
	for (let i = 0; i < 9; i++) { // only 9 times. 10th time is in itemNext()
		structure.selectorMove('down');
	}
	itemNext(stopPresentation);
}

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

// If hash is changed, something is being loaded (image of folder)
$(window).on('hashchange', function (event) {

	if (loadedStructure.mediaInfoCanvas.isShown()) {
		// Close currently opened media info
		// @HACK This supposed to be on "back" button (web browser or Android back) but no native event is available
		loadedStructure.mediaInfoCanvas.hide();
		event.preventDefault();
	}

	// save currently loaded folder but can't save FileItem, because we dont know structure yet.
	structure.setCurrent(pathFromUrl(window.location.hash));

	// Update browser title as browsing folders or files
	$('html head title').text(structure.getCurrentFolder().path + ' ☁ ' + $('html head title').data('original-title'));

	// load folder structure
	loadStructure(false, function () {

		// save currently loaded folder AND currently selected file (if any) because structure is already loaded
		structure.setCurrent(pathFromUrl(window.location.hash)); // save file if is opened in popup

		/*
		 * Open popup to show file
		 */
		const currentFile = structure.getCurrentFile();
		if (currentFile) { // loaded item is file
			setStatus(currentFile.getStatusLoadingText(Settings.load('compress')));
			structure.historyAdd(currentFile);
			if (
				presentation.running === true
				&& currentFile.isImage === false
				&& currentFile.isAudio === false
				&& currentFile.isVideo === false
				&& currentFile.isPdf === false
			) {
				// file is not viewable (zip...) so skip in presentation
				// @TODO causing bug, that file-icon is being visible under next viewable item (eg. audio)
				presentation.next();
			}

			$('html head title').text(currentFile.path + ' ☁ ' + $('html head title').data('original-title'));

			Promise.all([
				// Before continuing loading next item first has to hide previous,
				// otherwise while fading out it will flash new item
				$('#popup-video').fadeOut(Settings.load('animationSpeed')).promise(),
				$('#popup-audio').fadeOut(Settings.load('animationSpeed')).promise(),
				$('#popup-image').fadeOut(Settings.load('animationSpeed')).promise(),
				$('#popup-pdf').fadeOut(Settings.load('animationSpeed')).promise(),
				$('#popup-icon').fadeOut(Settings.load('animationSpeed')).promise(),
			]).then(function () {
				structure.selectorMove(currentFile.index); // highlight loaded image
				if (currentFile.coords) {
					$('#popup-location').attr('href', 'https://better-location.palider.cz/' + currentFile.coords).show();
				} else {
					$('#popup-location').hide();
				}

				let openUrl = currentFile.getFileUrl(false);
				let openUrlFull = currentFile.getFileUrl(false, false);
				const downloadUrl = currentFile.getFileUrl(true);
				const shareUrl = window.location.origin + '/#' + structure.getCurrentFile().url;

				if (openUrl === null) { // If item has no view url, use icon to indicate it is file that has to be downloaded
					openUrl = downloadUrl;
					openUrlFull = downloadUrl;
					$('#popup-icon').removeClass().addClass('fa fa-5x fa-' + currentFile.icon).fadeIn(Settings.load('animationSpeed'), function () {
						setStatus(false);
					});
				}
				$('#popup-open-media-url').attr('href', openUrlFull);
				$('#popup-media-details-download').attr('href', downloadUrl);
				$('#popup-media-details-open-full').attr('href', openUrlFull);
				$('#popup-media-details-share').attr('href', shareUrl);

				loadedStructure.mediaInfoCanvas.setItem(currentFile);

				popupOpen();

				function setMediaSrc(type, src) {
					$('#popup-' + type + ' source').attr('src', src);
					$('#popup-' + type + '')[0].load();
				}

				setMediaSrc('audio', '');
				setMediaSrc('video', '');

				if (currentFile.isImage) {
					$('#popup-image').attr('src', openUrl);
				} else if (currentFile.isPdf) {
					$('#popup-pdf').attr('data', downloadUrl).show();
				} else if (currentFile.isVideo) {
					setMediaSrc('video', openUrl);
				} else if (currentFile.isAudio) {
					setMediaSrc('audio', openUrl);
				} else {
					loadingDone();
				}

				// If currently opened Item in popup has marker, open map-popup too
				const currentFileMarker = structureMap.getMarkerFromStructureItem(currentFile);
				if (currentFileMarker) {
					structureMap.map.closePopup(); // Close all previously opened map-popups
					currentFileMarker.openPopup();
				}

				// @TODO upgrade counter to respect filter
				$('#popup-counter').text((currentFile.index + 1 - structure.getFolders().length) + '/' + structure.getFiles().length);

				// generate URL for previous file buttons
				const prevFile = structure.getPrevious(currentFile.index);
				let prevFileUrl = currentFile.url; // default is current file (do nothing)
				if (prevFile && prevFile.isFile) { // if there is some previous file
					prevFileUrl = prevFile.url;
				}
				$('#popup-prev').attr('href', '#' + prevFileUrl);

				// generate URL for next file buttons
				const nextFile = structure.getNext(currentFile.index);
				let nextFileUrl = currentFile.url; // default is current file (do nothing)
				if (nextFile && nextFile.isFile) { // if there is some next file
					nextFileUrl = nextFile.url;
				}
				$('#popup-next').attr('href', '#' + nextFileUrl);
			})
		} else { // If selected item is folder, load structure of that folder
			popupClose();
			structure.historyAdd(structure.getCurrentFolder());

			// Detect which file should be loaded
			let selectIndex = 0;
			const previousItem = structure.historyGet().last(2);
			if (previousItem instanceof FolderItem) {
				// changing folder (item should always be something)
				// deeper - this will find "go back" folder
				// closer to root - this will find previously opened folder
				const item = structure.getByName(previousItem.path);
				if (item) {
					selectIndex = item.index;
				}
			} else if (previousItem instanceof FileItem) {
				// Popup was just closed, dont change selected index
				selectIndex = structure.selectedIndex;
			}
			structure.selectorMove(selectIndex);
		}
	});
});

/**
 * Webpage loading is done
 */
$(function () {
	updateLoginButtons();

	// Save original title into data property
	$('html head title').data('original-title', $('html head title').text());

	// If is set redirect, load this
	if (Cookies.get('pmg-redirect')) {
		window.location.hash = pathToUrl(Cookies.get('pmg-redirect'));
		Cookies.remove('pmg-redirect');
	}

	loadedStructure.mediaInfoCanvas = new MediaDetailsCanvas();

	// If not set hash, load url from last time
	if (!window.location.hash && Settings.load('hashBeforeUnload')) {
		window.location.hash = pathToUrl(Settings.load('hashBeforeUnload'));
	} else {
		window.dispatchEvent(new HashChangeEvent("hashchange"));
	}
	// S.setCurrent(pathFromUrl(window.location.hash));
	$('#user-button-logout').on('click', function (event) {
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		event.preventDefault();
		if (confirm('Opravdu se chceš odhlásit?')) {
			// remove cookie on the server (without refreshing browser)
			$.get("/logout", function () {
				// remove cookie from the browser (just in case of error)
				// Cookies.remove('google-login');
				updateLoginButtons();
				loadStructure(true);
				loadUserData();
				flashMessage('Odhlášení bylo úspěšné.');
			});
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
		$('#structure-download-archive').remove();
	}


	loadUserData();

	$('#popup-close, #popup-top-left').on('click', function () {
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		popupClose();
	});
	$('#popup-content').on('click', function (event) {
		if (event.target === this) {
			// Close popup if clicked on background area around
			// media but not if clicked on any other element on page
			vibrateApi.vibrate(Settings.load('vibrationOk'));
			popupClose();
		}
	});

	// Event - swipe in popup
	// @TODO not detecting if swipe starts in different DOM than defined (eg. #status)
	$('#popup-content').swipeDetector()
		.on('swipeLeft.sd', () => itemNext(false))
		.on('swipeRight.sd', () => itemPrev(true))
		.on('swipeDown.sd', () => popupClose())
		.on('swipeUp.sd', () => loadedStructure.mediaInfoCanvas.show());

	// Event - swipe in popup media details
	$('#popup-media-details').swipeDetector()
		.on('swipeRight.sd', () => loadedStructure.mediaInfoCanvas.hide())

	// Event - click on image to open in new tab
	$("#popup-image").on('click', function () {
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		$('#popup-open-media-url')[0].click();
	});

	// Event - click on video to pause/play
	$("#popup-video").on('click', function () {
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		videoToggle();
	});

	// Event - click on video to pause/play
	$("#popup-audio").on('click', function () {
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		audioToggle();
	});

	// Event - show/hide map in advanced search and try to silently load user's location
	$('#advanced-search-sort input[name=sort]').on('change', function () {
		const value = $(this).val().toLowerCase();
		if (value === 'distance asc' || value === 'distance desc') {
			advancedSearchMap.mapShow();
		} else {
			advancedSearchMap.mapHide();
		}
	});

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
	 * Fill form settings with values from Settings class
	 * @TODO upgrade to works with all types of inputs (text, number, radio, checkbox...)
	 */
	$('#form-settings input[type=number]').each(function () { // type=number
		$(this).val(Settings.load($(this).attr('name')));
	});
	$('#form-settings input[type=radio]').each(function () { // type=radio
		if ($(this).val() === Settings.load($(this).attr('name'))) {
			$(this).prop("checked", true);
		}
	});
	$('#form-settings input[type=checkbox]').each(function () { // type=radio
		if (Settings.load($(this).attr('name'))) {
			$(this).prop("checked", true);
		}
	});

	/**
	 * Save form values to Settings class
	 */
	$('#form-settings').on('change submit', function (event) {
		event.preventDefault();
		// save all inputs from form into Settings
		$(this).serializeArray().forEach(function (input) {
			Settings.save(input.name, input.value)
		});
		// un-checked checkbox inputs are not in serializedArray, needs to be handled separately
		$('#form-settings input[type="checkbox"]').each(function () {
			Settings.save($(this).attr('name'), $(this).is(':checked'))
		});
		// set compress variable into cookie on save
		if (Settings.load('compress') === true) {
			Cookies.set('pmg-compress', true);
		} else {
			Cookies.remove('pmg-compress');
		}
		// set item limit variable into cookie on save
		Cookies.set('pmg-item-limit', Settings.load('structureItemLimit'));

		// show info about save to user
		$('#settings-save')
			.html('Uloženo <i class="fa fa-check"></i>')
			.addClass('btn-success')
			.removeClass('btn-primary')
			.prop('disabled', true);
		setTimeout(function () {
			$('#settings-save')
				.html('Uložit')
				.removeClass('btn-success')
				.addClass('btn-primary')
				.prop('disabled', false);
		}, 2000);
	});

	// Load and set type of view from Settings
	structureViewChange(Settings.load('structureDisplayType'));

	// Event - changed type of tiles view
	$('#structure-display-type button').on('click', function () {
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		structureViewChange($(this).find('input').val());
	});

	// Event - clicked on zip download
	$('#structure-download-archive').on('click', function (event) {
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		if (confirm('Opravdu chceš stáhnout obsah této složky i všech podsložek jako ZIP?') === false) {
			event.preventDefault();
		}
	});

	// Event - clicked on rescan folder
	$('#structure-scan-run').on('click', function (event) {
		event.preventDefault();
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		const $btn = $(this);
		const $btnIcon = $btn.children('i.fa');
		loadedStructure.request = $.ajax({
			url: '/api/scan',
			method: 'GET',
			data: {
				path: btoa(encodeURIComponent(structure.getCurrentFolder().path)),
			},
			success: function (result) {
				const flashType = result.error === true ? 'danger' : 'info';
				flashMessage(result.message, flashType);
				if (result.result.scanning === false) {
					loadStructure(true);
				}
			},
			error: function (result, errorTextStatus) {
				flashMessage(result.responseJSON ? result.responseJSON.message : 'Chyba během zahájení scanování. Kontaktuj autora.', 'danger', false);
			},
			beforeSend: function () {
				$btn.addClass('disabled');
				$btnIcon.addClass('fa-circle-o-notch fa-spin').removeClass('fa-refresh');
			},
			complete: function () {
				$btn.removeClass('disabled');
				$btnIcon.addClass('fa-refresh').removeClass('fa-circle-o-notch fa-spin');
			},
		});
	});

	// Event - selected item in structure
	$('#structure').on('click', '.structure-item', function (event) {
		if ($(event.target).closest('.location').length === 0) { // do not select in structure, just open link
			event.preventDefault();
			const itemIndex = $(this).data('index');
			if (itemIndex !== undefined) {
				vibrateApi.vibrate(Settings.load('vibrationOk'));
				structure.selectorMove(itemIndex);
				structure.selectorSelect();
			}
		}
	});

	/**
	 * set compress variable into cookie on page load
	 */
	if (Settings.load('compress') === true) {
		Cookies.set('pmg-compress', true);
	} else {
		Cookies.remove('pmg-compress');
	}
	/**
	 * Set item limit variable into cookie on page load
	 */
	Cookies.set('pmg-item-limit', Settings.load('structureItemLimit'));

	/**
	 * Showing saved passwords in settings
	 */
	$('#settings-passwords-load').on('click', function () {
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		const button = this;
		$(button).html('Načítám <i class="fa fa-circle-o-notch fa-spin"></i>').prop('disabled', true);

		$('#settings-passwords-nothing').hide();
		$('#settings-passwords-list').empty();

		$.getJSON("/api/password", function (response) {
			if (response.result.length === 0) {
				$('#settings-passwords-nothing').show();
				return;
			}
			response.result.forEach(function (pass) {
				let html = '<h5>' + pass.password + ':</h5>';
				let htmlPasswords = [];
				pass.permissions.forEach(function (perm) {
					htmlPasswords.push('<a href="#' + pathToUrl(perm) + '">' + perm + '</a>');
				});
				html += '<p>' + htmlPasswords.join('<br>') + '</p>';
				$('#settings-passwords-list').append(html);
			});
		}).fail(function (response) {
			flashMessage('Error <b>' + response.status + '</b> while loading passwords: <b>' + response.statusText + '</b>', 'danger', false);
		}).always(function () {
			setTimeout(function () {
				$(button).html('Načíst hesla').prop('disabled', false);
			}, 500);
		});
	});

	$('#popup-pdf').on('load', function () {
		loadingDone(this);
	});

	$('#popup-video').on('loadeddata', function () {
		loadingDone(this);
	}).on('ended', function () {
		if (presentation.running) {
			presentation.next();
		}
	});

	$('#popup-audio').on('loadeddata', function () {
		loadingDone(this);
	}).on('ended', function () {
		if (presentation.running) {
			presentation.next();
		}
	});

	// loading is done when img is loaded
	$('#popup-image').on('load', function () {
		loadingDone(this);
	}).on('error', function () {
		flashMessage('Chyba během načítání obrázku. Kontaktuj autora.', 'danger', false);
		setStatus(false);
	})

	$('#navbar').on('click', '#navbar-share', async function (event) { // Event - share URL
		event.preventDefault();
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		await shareItem(structure.getCurrentFolder());
	}).on('click', '#navbar-favourites-add', function (event) { // Event - add to favourites
		event.preventDefault();
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		favouritesAdd(structure.getCurrentFolder().path);
	}).on('click', '#navbar-favourites-remove', function (event) { // Event - remove from favourites
		event.preventDefault();
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		favouritesRemove(structure.getCurrentFolder().path);
	});

	// Event - load next item if possible
	$('#popup-next').on('click', function () {
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		itemNext(false); // dont stop presentation mode
	});
	// Event - load previous item if possible
	$('#popup-prev').on('click', function () {
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		itemPrev(true);
	});

	// Event - share file url from popup
	$('#popup-media-details-share').on('click', async function () {
		vibrateApi.vibrate(Settings.load('vibrationOk'));
		await shareItem(structure.getCurrentFile());
	});

	$('#modal-settings').on('show.bs.modal', function () {
		loadedStructure.settings = true;
		vibrateApi.vibrate(Settings.load('vibrationOk'));
	}).on('hidden.bs.modal', function () {
		loadedStructure.settings = false;
		vibrateApi.vibrate(Settings.load('vibrationOk'));
	});

	$('#modal-search').on('show.bs.modal', function () {
		loadedStructure.advancedSearchModal = true;
		vibrateApi.vibrate(Settings.load('vibrationOk'));
	}).on('hidden.bs.modal', function () {
		loadedStructure.advancedSearchModal = false;
		vibrateApi.vibrate(Settings.load('vibrationOk'));
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
	}).on('click', '#navbar .breadcrumb-item', function (event) {
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
});

function mapInfoWindowImageLoaded() {
	$('#map-info-window .thumbnail-not-loaded').removeClass('thumbnail-not-loaded').show();
	$('#map-info-window .thumbnail-loading-icon').remove();
}

function mapInfoWindowImageError() {
	$('#map-info-window .thumbnail-loading-icon').removeClass('fa-circle-o-notch fa-spin').addClass('fa-' + Icon.IMAGE);
}

function popupOpen() {
	loadedStructure.popup = true;
	$("#structure-search input").trigger('blur');
	$('#popup').fadeIn(Settings.load('animationSpeed'));
	document.body.style.overflow = 'hidden';
}

function popupClose() {
	$('#popup').fadeOut(Settings.load('animationSpeed'));
	// This will prevent waiting (promise) on re-opening popup window:
	// animation in promise will skip if elements are already faded out
	$('#popup-video').fadeOut(Settings.load('animationSpeed')).promise();
	$('#popup-audio').fadeOut(Settings.load('animationSpeed')).promise();
	$('#popup-pdf').fadeOut(Settings.load('animationSpeed')).promise();
	// update image src to cancel loading
	// @author https://stackoverflow.com/a/5278475/3334403
	$('#popup-image').attr('src', transparentPixelBase64).fadeOut(Settings.load('animationSpeed')).promise();
	loadedStructure.popup = false;
	window.location.hash = structure.getCurrentFolder().url;
	videoPause();
	audioPause();
	presentation.stop();
	setStatus(false);
	document.body.style.overflow = null;
}

function favouritesAdd(path) {
	let saved = Settings.load('favouriteFolders');
	saved.pushUnique(path);
	flashMessage('Folder has been added to favourites.');
	Settings.save('favouriteFolders', saved);
	favouritesGenerateMenu();
}

function favouritesRemove(path) {
	let saved = Settings.load('favouriteFolders');
	saved.removeByValue(path);
	flashMessage('Folder has been removed from favourites.');
	Settings.save('favouriteFolders', saved);
	favouritesGenerateMenu();
}

function favouritesIs(path) {
	return (Settings.load('favouriteFolders').indexOf(path) >= 0)
}

/**
 * Remove all generated items in navbar favourites dropdown content and generate new data
 * Also update navbar favourites button to reflect if currently opened path is saved or not
 */
function favouritesGenerateMenu() {
	// Update navbar dropdown content
	$('#navbar-dropdown-content .dropdown-item-favourites').remove();
	const saved = Settings.load('favouriteFolders');
	if (saved.length === 0) { // nothing is saved
		$('#navbar-dropdown-content').append('<div class="dropdown-item dropdown-item-favourites disabled">No saved items</div>');
	}
	saved.forEach(function (savedFolder) {
		$('#navbar-dropdown-content').append('<a class="dropdown-item dropdown-item-favourites" href="#' + pathToUrl(savedFolder) + '">' + savedFolder + ' <i class="fa fa-fw fa-star"></i></a>');
	});

	// Update navbar favourites button and toggle showing add to and remove from favourites
	const currentFolderPath = structure.getCurrentFolder().path;
	if (favouritesIs(currentFolderPath)) { // show button only to remove from favourites
		$('#navbar-favourites-button i.fa').addClass('fa-star').removeClass('fa-star-o');
		$('#navbar-favourites-add').hide();
		$('#navbar-favourites-remove').show();
	} else { // show button only to add to favourites
		$('#navbar-favourites-button i.fa').addClass('fa-star-o').removeClass('fa-star');
		$('#navbar-favourites-add').show();
		$('#navbar-favourites-remove').hide();
	}
}

function videoToggle() {
	try {
		if ($('#popup-video')[0].paused) {
			videoPlay();
		} else {
			videoPause();
		}
	} catch (exception) {
		// In case of invalid src (for example)
	}
}

function videoPause() {
	try {
		$('#popup-video')[0].pause();
	} catch (exception) {
		// In case of invalid src (for example)
	}
}

function videoPlay() {
	try {
		$('#popup-video')[0].play();
	} catch (exception) {
		// In case of invalid src (for example)
	}
}

function audioToggle() {
	try {
		if ($('#popup-audio')[0].paused) {
			audioPlay();
		} else {
			audioPause();
		}
	} catch (exception) {
		// In case of invalid src (for example)
	}
}

function audioPause() {
	try {
		$('#popup-audio')[0].pause();
	} catch (exception) {
		// In case of invalid src (for example)
	}
}

function audioPlay() {
	try {
		$('#popup-audio')[0].play();
	} catch (exception) {
		// In case of invalid src (for example)
	}
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
				if (user && user.email) {
					$('#user-logged-in .user-email').text(user.email);
				}

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

async function loadSearch(path = null) {
	const requestData = {
		path: btoa(path !== null ? path : encodeURIComponent(structure.getCurrentFolder().path)),
		sort: $('#advanced-search-sort input[name=sort]:checked').val(),
	}

	let searchValidatorError = null;

	let query = $('#structure-search-input').val().trim();
	if (query) {
		requestData.query = query;
		searchValidatorError = null;
	}
	if ($('input.advanced-search-sort-distance:checked').length > 0) {
		const $selectedCoords = $('#advanced-search-coords');
		requestData.lat = $selectedCoords.data('lat');
		requestData.lon = $selectedCoords.data('lon');
		if (Coordinates.isLat(requestData.lat) && Coordinates.isLon(requestData.lon)) {
			searchValidatorError = null;
		} else {
			searchValidatorError = 'Pokud chceš seřadit od nejbližších, musíš mít vybraný bod v mapě.';
		}
	}

	const slider = document.getElementById('advanced-search-size');
	if (slider.noUiSlider) { // slider might not be available (eg. no scanned files with size)
		const [sizeMin, sizeMax] = slider.noUiSlider.get(true);
		if (sizeMin !== 0) { // Send sizeMin only if higher than zero
			requestData.sizeMin = Math.floor(sizeMin);
		}
		if (sizeMax !== FILE_SIZE_PERCENTILES[FILE_SIZE_PERCENTILES.length - 1].fileSize) {
			// Send sizeMax only if not equals to biggest file available
			requestData.sizeMax = Math.ceil(sizeMax);
		}
	}

	if (searchValidatorError) {
		flashMessage(searchValidatorError, 'danger');
		return;
	}

	if (loadedStructure.request) {
		console.log("Aborting previous request for creating new");
		loadedStructure.request.abort();
	}
	loadedStructure.request = $.ajax({
		url: '/api/search',
		method: 'GET',
		data: requestData,
		success: function (result) {
			if (result.error === true || !result.result) {
				flashMessage(result.message || 'Chyba během hledání. Kontaktuj autora.', 'danger', false);
			} else {
				parseStructure(result.result);
				structure.selectorMove('first');
				structureMap.markersFromStructureFiles(structure.getFiles());
				structure.filter();
				loadThumbnail();
			}
		},
		error: function (result, errorTextStatus) {
			if (errorTextStatus === 'abort') {
				console.log("Request aborted");
			} else {
				flashMessage(result.responseJSON ? result.responseJSON.message : 'Chyba během hledání. Kontaktuj autora.', 'danger', false);
			}
		},
		beforeSend: function () {
			loadingStructure(true);
			$('#structure-search .search i.fa').addClass('fa-circle-o-notch fa-spin').removeClass('fa-search');
		},
		complete: function () {
			loadingStructure(false);
			$('#structure-search .search i.fa').removeClass('fa-circle-o-notch fa-spin').addClass('fa-search');
		}
	});
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
		return;
	}

	const thumbnailsNotLoaded = $('.thumbnail-not-loaded:not(.thumbnail-loading)');
	if (thumbnailsNotLoaded.length === 0) {
		return;
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
		thumbnailToLoad.removeClass('thumbnail-not-loaded');
		loadThumbnail();
	}).attr('src', thumbnailToLoad.data('src'));
	loadThumbnail();
}

function loadStructure(force, callback) {
	// in case of triggering loading the same structure again (already loaded), skip it
	if (force !== true && loadedStructure.loadedFolder === structure.getCurrentFolder().path) {
		console.log("Structure is already loaded, skip");
		return (typeof callback === 'function' && callback());
	}
	if (loadedStructure.request) {
		console.log("Aborting previous request for creating new");
		loadedStructure.request.abort();
	}
	loadedStructure.request = $.ajax({
		url: '/api/structure',
		method: 'GET',
		data: {
			path: btoa(encodeURIComponent(structure.getCurrentFolder().path))
		},
		success: function (result) {
			if (result.error === true || !result.result) {
				flashMessage((
						(result.message || 'Chyba během načítání dat. Kontaktuj autora.') +
						'<br>Zkus se <a href="/login" class="alert-link">přihlásit</a> nebo jít <a href="#" class="alert-link">domů</a>.'
					), 'danger', false
				);
			} else {
				$('#structure-header').html(result.result.header || '');
				$('#structure-footer').html(result.result.footer || '');
				parseStructure(result.result);
				structureMap.markersFromStructureFiles(structure.getFiles());
				$('#structure-search input').val('');
				loadThumbnail();
				structure.filter();
			}
		},
		error: function (result, errorTextStatus) {
			if (errorTextStatus === 'abort') {
				console.log("Request aborted");
			} else {
				flashMessage(result.responseJSON ? result.responseJSON.message : 'Chyba během načítání dat. Kontaktuj autora.', 'danger', false);
			}
		},
		beforeSend: function () {
			loadingStructure(true);
		},
		complete: function () {
			loadedStructure.request = null;
			loadingStructure(false);
			(typeof callback === 'function' && callback());
		}
	});
}

function parseStructure(items) {
	// in case of triggering loading the same structure again (already loaded), skip it
	updateLoginButtons(); // might be logged out

	loadedStructure.loadedFolder = structure.getCurrentFolder().path;
	structure.setAll(items);
	const currentFolder = structure.getCurrentFolder();

	/**
	 * Generate breadcrumb urls in menu
	 */
	let maxVisible = structure.getItems().length;
	let breadcrumbHtml = '';
	// noinspection HtmlUnknownAnchorTarget
	breadcrumbHtml += '<li class="breadcrumb-item"><a href="#/" title="Go to root folder"><i class="fa fa-home"></i></a></li>';
	let breadcrumbPath = '/';
	currentFolder.paths.forEach(function (folderName, index) {
		breadcrumbHtml += '<li class="breadcrumb-item"><a href="#' + (breadcrumbPath += currentFolder.urls[index] + '/') + '">' + folderName + '</a></li>';
	});
	$('#currentPath').html(breadcrumbHtml);

	favouritesGenerateMenu();

	$('#structure-download-archive').attr('href', structure.getCurrentFolder().getArchiveUrl());

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

	structure.getFolders().forEach(function (item) {
		if (item.noFilter) {
			maxVisible--;
		}
		contentTiles += '<span class="structure-item item-index-' + item.index + '" data-index="' + item.index + '">';
		contentTiles += ' <i class="fa fa-' + item.icon + ' fa-fw icon"></i>';
		if (!item.noFilter && CONFIG.thumbnails.folder.enabled === true) {
			contentTiles += ' <img class="thumbnail thumbnail-not-loaded" src="' + transparentPixelBase64 + '" data-src="' + item.getThumbnailUrl() + '">';
		} else {
			contentTiles += ' <img class="thumbnail" src="' + transparentPixelBase64 + '">'; // fake thumbnail for proper display
		}
		contentTiles += ' <a class="name" href="#' + item.url + '">' + item.text + '</a>';
		if (item.created) {
			const created = item.created.human(true);
			contentTiles += ' <span class="created" title="' + created + ' (' + msToHuman(Math.max(new Date().getTime() - item.created, 0)) + ' ago)">' + created.date + ' <span>' + created.time + '</span></span>';
		}
		contentTiles += '</span>';
	});
	if (items.foldersTotal > items.folders.length) {
		const text = 'Celkem je zde ' + (items.foldersTotal) + ' složek ale z důvodu rychlosti jsou některé skryty. Limit můžeš ovlivnit v nastavení.';
		contentTiles += '<span class="structure-item">';
		contentTiles += ' <i class="icon fa fa-info fa-fw"></i>';
		contentTiles += ' <img class="thumbnail" src="' + transparentPixelBase64 + '">'; // fake thumbnail for proper display
		contentTiles += ' <span class="name">' + text + '</span>';
		contentTiles += '</span>';
	}

	structure.getFiles().forEach(function (item) {
		contentTiles += '<span class="structure-item item-index-' + item.index + '" data-index="' + item.index + '">';
		contentTiles += ' <i class="icon fa fa-' + item.icon + ' fa-fw"></i>';

		const thumbnailUrl = item.getThumbnailUrl();
		const thumbnailEnabled = (
			(item.isImage && CONFIG.thumbnails.image.enabled)
			|| (item.isVideo && CONFIG.thumbnails.video.enabled)
		)
		if (thumbnailEnabled && thumbnailUrl) {
			contentTiles += ' <img class="thumbnail thumbnail-not-loaded" src="' + transparentPixelBase64 + '" data-src="' + thumbnailUrl + '">';
		} else {
			contentTiles += ' <img class="thumbnail" src="' + transparentPixelBase64 + '">'; // fake thumbnail for proper display
		}

		contentTiles += ' <a href="#' + item.url + '" class="name">' + item.text + '</a>';

		if (item.distance) {
			contentTiles += ' <span class="distance">' + formatDistance(item.distance) + '</span>';
		}
		if (item.coords) {
			contentTiles += ' <a href="https://better-location.palider.cz/' + item.coords + '" class="location" target="_blank" title="Open coordinates ' + item.coords + ' in Better Location"><i class="fa fa-map-marker"></i></a>';
		}
		if (item.size !== null) {
			contentTiles += ' <span class="size">' + formatBytes(item.size, 2) + '</span>';
		}
		if (item.created) {
			const created = item.created.human(true);
			contentTiles += ' <span class="created" title="' + created + ' (' + msToHuman(Math.max(new Date().getTime() - item.created, 0)) + ' ago)">' + created.date + ' <span>' + created.time + '</span></span>';
		}
		contentTiles += '</span>';
	});
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
	if (items.lastScan) {
		const lastScan = new Date(items.lastScan);
		const lastScanHuman = lastScan.human(true);
		let dateHtml = '';
		if ((new Date()).human(true).date !== lastScanHuman.date) { // show also date if scan was not performed today
			dateHtml += lastScanHuman.date + ' ';
		}
		dateHtml += lastScanHuman.time;
		dateHtml += ' (' + lastScan.agoHuman(true) + ' ago)';
		$('#structure-scan .date').html(dateHtml);
		$('#structure-scan').show();
	} else {
		$('#structure-scan').hide();
	}
	$('#structure-tiles').html(contentTiles);
	$('#structure-search .total').text(maxVisible);
	$('#structure-search .filtered').text(maxVisible);
}

function loadingStructure(loading) {
	if (loading === true) {
		// add loading icon to specific item in structure
		$('#structure-search .filtered').html('<i class="fa fa-circle-o-notch fa-spin"></i>');
		$('#structure-search .total').html('<i class="fa fa-circle-o-notch fa-spin"></i>');
		$('#structure-search input').prop('disabled', true);
		$('#structure-search .search').prop('disabled', true);
		// @TODO set different message if searching
		setStatus('Loading folder "<span title="' + structure.getCurrentFolder().path + '">' + structure.getCurrentFolder().text + '</span>"');
	}
	if (loading === false) {
		setStatus(false);
		$('#structure-search input').prop('disabled', false);
		$('#structure-search .search').prop('disabled', false);

		// Event - thumbnail can't be loaded, destroy that element
		// @FIXME this handler should be created only once (on page load) instead on every structure load but for some reason it don't work
		$('#structure .structure-item img.thumbnail').on('error', function () {
			this.remove();
		});
	}
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
 * @param {Item} item
 */
async function shareItem(item) {
	const niceUrl = window.location.origin + '/#' + item.url

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

	// Force set to default view if invalid type detected. Mainly for backward compatibility,
	// if name of some view name change, eg "rows" -> "rows-small"
	if (allowedValues.includes(value) === false) {
		value = allowedValues[0];
		console.warn(`Value "${value}" is not valid structure view, changed to "${allowedValues[0]}".`);
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
		$('#structure-download-archive').hide();
		$('#structure-scan').hide();
		structureBrowserMap.mapShow();
	} else {
		$('#structure-tiles').show();
		$('#structure-search').show();
		$('#structure-download-archive').show();
		$('#structure-scan').show();
		structureBrowserMap.mapHide();
	}

	// start loading thumbnails
	loadThumbnail();
}

/**
 * Calculate how many tiles are on one row
 *
 * @author https://stackoverflow.com/a/11539490/3334403
 * @param {boolean} last get number of tiles on last row
 */
function getTilesCount(last = false) {
	let tilesInRow = 0;
	let selector = '#structure-tiles .structure-item';
	$(selector).each(function () {
		if ($(this).prev().length > 0) {
			// Position top is not calculating with eventual border (if item is selected or hover over). In that case position
			// of element is a little bit lower than others even on same line (according tests it should be less than pixel)
			if (Math.ceil($(this).position().top) !== Math.ceil($(this).prev().position().top)) {
				return false;
			}
			tilesInRow++;
		} else {
			tilesInRow++;
		}
	});
	if (last === true) {
		let tilesInLastRow = $(selector).length % tilesInRow;
		if (tilesInLastRow === 0) {
			tilesInLastRow = tilesInRow;
		}
		return tilesInLastRow;
	}
	return tilesInRow;
}
