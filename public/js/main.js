/* global Settings */
const loadedStructure = {
	loadedFolder: '', // default is loaded nothing
	popup: false, // Is popup visible?
	settings: false, // is settings modal visible?
	filtering: false,
	flashIndex: 0, // incremental index used for flashMessage()
	presentationRunning: false,
	presentationIntervalId: null,
};
const mapData = {
	map: null,
	mapBounds: null,
	markers: {
		photos: {},
	},
	selectedMarker: null,
	infoWindow: null
};

const S = new Structure();

function loadAndResize() {
	// resize image in popup to fit the screen
	const height = window.innerHeight - $('#popup-footer').outerHeight();
	$('#popup')
		.css('height', height)
		.css('width', window.innerWidth);
	$('#popup-content')
		.css('max-height', height)
		.css('max-width', window.innerWidth);
}

$(window).on('resize', function () {
	loadAndResize();
});

function loadingDone(element) {
	if (element) {
		$(element).fadeIn(Settings.load('animationSpeed'), function () {
			loadingPopup(false);
		});
		if ($(element).is('video')) {
			if (loadedStructure.presentationRunning) { // presentation is enabled
				if (presentationIsLast()) {
					presentationStop(); // manually stop presentation to toggle play button immediately
				}
				videoPlay();
			}
		} else if ($(element).is('audio')) {
			if (loadedStructure.presentationRunning) { // presentation is enabled
				if (presentationIsLast()) {
					presentationStop(); // manually stop presentation to toggle play button immediately
				}
				audioPlay();
			}
		} else if ($(element).is('img')) {
			if (loadedStructure.presentationRunning) { // presentation is enabled
				if (presentationIsLast()) {
					presentationStop(); // manually stop presentation to toggle play button immediately
				}
				// load next item after presentation timeout
				loadedStructure.presentationIntervalId = setTimeout(function () {
					presentationNext();
				}, Settings.load('presentationSpeed'));
			}
		}
	} else {
		loadingPopup(false);
	}
}

/**
 * Shortcuts to proper handling moving between items if popup is opened (respect presentation mode)
 */
function itemPrev10(stopPresentation) {
	for (let i = 0; i < 9; i++) { // only 9 times. 10th time is in itemPrev()
		S.selectorMove('up');
	}
	itemPrev(stopPresentation);
}

function itemPrev(stopPresentation) {
	if (stopPresentation === true) {
		presentationStop();
	}
	presentationClearTimeout(); // to prevent running multiple presentation timeouts at the same time
	videoPause();
	audioPause();
	S.selectorMove('up');
	// if new selected item is not file, select first file and show it
	if (S.getItem(S.selectedIndex).isFile === false) {
		S.selectorMove(S.getFirstFile().index);
	}
	S.selectorSelect();
}

function itemNext(stopPresentation) {
	if (stopPresentation === true) {
		presentationStop();
	}
	presentationClearTimeout(); // to prevent running multiple presentation timeouts at the same time
	videoPause();
	audioPause();
	S.selectorMove('down');
	S.selectorSelect();
}

function itemNext10(stopPresentation) {
	for (let i = 0; i < 9; i++) { // only 9 times. 10th time is in itemNext()
		S.selectorMove('down');
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
	alert('Nastala neočekávaná chyba. Pokud se opakuje, udělej screenshot obrazovky a kontaktuj správce.\n' + text);
	// If you return true, then error alerts (like in older versions of Internet Explorer) will be suppressed.
	// return true;
};

// If hash is changed, something is being loaded (image of folder)
$(window).on('hashchange', function (event) {
	// save currently loaded folder but can't save FileItem, because we dont know structure yet.
	S.setCurrent(pathFromUrl(window.location.hash));

	// Update browser title as browsing folders or files
	$('html head title').text(S.getCurrentFolder().path + ' ☁ ' + $('html head title').data('original-title'));

	// load folder structure
	loadStructure(false, function () {

		// save currently loaded folder AND currently selected file (if any) because structure is already loaded
		S.setCurrent(pathFromUrl(window.location.hash)); // save file if is opened in popup

		/*
		 * Open popup to show file
		 */
		const currentFile = S.getCurrentFile();
		if (currentFile) { // loaded item is file
			loadingPopup(true); // starting loading img
			S.historyAdd(currentFile);

			$('html head title').text(currentFile.path + ' ☁ ' + $('html head title').data('original-title'));

			Promise.all([
				// Before continuing loading next item first has to hide previous,
				// otherwise while fading out it will flash new item
				$('#popup-video').fadeOut(Settings.load('animationSpeed')).promise(),
				$('#popup-audio').fadeOut(Settings.load('animationSpeed')).promise(),
				$('#popup-image').fadeOut(Settings.load('animationSpeed')).promise(),
				$('#popup-icon').fadeOut(Settings.load('animationSpeed')).promise(),
			]).then(function () {
				S.selectorMove(currentFile.index); // highlight loaded image
				if (currentFile.coordLat && currentFile.coordLon) {
					$('#popup-location').attr('href', 'https://www.google.cz/maps/place/' + currentFile.coordLat + ',' + currentFile.coordLon).show();
				} else {
					$('#popup-location').hide();
				}

				let openUrl = currentFile.getFileUrl();
				const downloadUrl = currentFile.getFileUrl(true);
				if (openUrl === null) { // If item has no view url, use icon to indicate it is file that has to be downloaded
					openUrl = downloadUrl;
					$('#popup-icon').removeClass().addClass('fa fa-5x fa-' + currentFile.icon).fadeIn(Settings.load('animationSpeed'), function () {
						loadingPopup(false);
					});
				}
				$('#popup-filename').text(currentFile.text).attr('href', openUrl);
				$('#popup-download').attr('href', downloadUrl);
				popupOpen();
				let openInfoWindowMarker = null;
				if (currentFile.isImage) {
					$('#popup-image').attr('src', openUrl);
					openInfoWindowMarker = mapData.markers.photos[currentFile.index] || null;
				} else if (currentFile.isVideo) {
					$('#popup-video source').attr('src', openUrl);
					$('#popup-video')[0].load();
				} else if (currentFile.isAudio) {
					$('#popup-audio source').attr('src', openUrl);
					$('#popup-audio')[0].load();
				} else {
					loadingDone();
				}

				// If currently opened Item in popup has marker, open InfoWindow in map
				if (openInfoWindowMarker) {
					new google.maps.event.trigger(openInfoWindowMarker, 'click');
				} else {
					mapData.infoWindow.close();
				}

				// @TODO upgrade counter to respect filter
				$('#popup-counter').text((currentFile.index + 1 - S.getFolders().length) + '/' + S.getFiles().length);

				// generate URL for previous file buttons
				const prevFile = S.getPrevious(currentFile.index);
				let prevFileUrl = currentFile.url; // default is current file (do nothing)
				if (prevFile && prevFile.isFile) { // if there is some previous file
					prevFileUrl = prevFile.url;
				}
				$('#popup-footer-prev').attr('href', '#' + prevFileUrl);
				$('#popup-prev').attr('href', '#' + prevFileUrl);

				// generate URL for next file buttons
				const nextFile = S.getNext(currentFile.index);
				let nextFileUrl = currentFile.url; // default is current file (do nothing)
				if (nextFile && nextFile.isFile) { // if there is some next file
					nextFileUrl = nextFile.url;
				}
				$('#popup-footer-next').attr('href', '#' + nextFileUrl);
				$('#popup-next').attr('href', '#' + nextFileUrl);
			})
		} else { // If selected item is folder, load structure of that folder
			popupClose();
			S.historyAdd(S.getCurrentFolder());

			// Detect which file should be loaded
			let selectIndex = 0;
			const previousItem = S.historyGet().last(2);
			if (previousItem instanceof FolderItem) {
				// changing folder (item should always be something)
				// deeper - this will find "go back" folder
				// closer to root - this will find previously opened folder
				const item = S.getByName(previousItem.path);
				if (item) {
					selectIndex = item.index;
				}
			} else if (previousItem instanceof FileItem) {
				// Popup was just closed, dont change selected index
				selectIndex = S.selectedIndex;
			}
			S.selectorMove(selectIndex);
		}

		// if there is no history or last two history items has different folders
		const history1 = S.historyGet().last(1);
		const history2 = S.historyGet().last(2);
		if (!history1 || !history2 || history1.folder !== history2.folder) {
			mapParsePhotos();
		}
	});
});

/**
 * Webpage loading is done
 */
$(function () {
	loadAndResize();
	updateLoginButtons();

	// Save original title into data property
	$('html head title').data('original-title', $('html head title').text());

	// If is set redirect, load this
	if (Cookies.get('pmg-redirect')) {
		window.location.hash = pathToUrl(Cookies.get('pmg-redirect'));
		Cookies.remove('pmg-redirect');
	}
	// If not set hash, load url from last time
	if (!window.location.hash && Settings.load('hashBeforeUnload')) {
		window.location.hash = pathToUrl(Settings.load('hashBeforeUnload'));
	} else {
		window.dispatchEvent(new HashChangeEvent("hashchange"));
	}
	// S.setCurrent(pathFromUrl(window.location.hash));
	$('[data-toggle="tooltip"]').tooltip({html: true});
	$('#button-logout').on('click', function (event) {
		event.preventDefault();
		if (confirm('Opravdu se chceš odhlásit?')) {
			// remove cookie on the server (without refreshing browser)
			$.get("/logout", function () {
				// remove cookie from the browser (just in case of error)
				Cookies.remove('google-login');
				updateLoginButtons();
				loadStructure(true);
				alert('Odhlášení bylo úspěšné.');
			});
		}
	});

	$('#popup-close, #popup-content').on('click', function () {
		popupClose();
	});
	$('#navbar-filter .search').on('click', function (event) {
		event.preventDefault();
		loadSearch();
	});

	$('#popup-footer-presentation').on('click', function () {
		if (loadedStructure.presentationRunning) {
			presentationStop();
		} else {
			presentationStart();
		}
	});

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
	 * Toggle dark theme
	 */
	$('#settings-theme input').on('click', function () {
		let theme = 'default';
		if ($('#settings-theme-dark').is(':checked')) {
			theme = 'dark';
		}
		$('body').removeClass().addClass('theme-' + theme);
	});

	// some line is selected
	$('#structure').on('click', 'table tbody tr', function (e) {
		e.preventDefault();
		S.selectorMove($(this).data('index'));
		S.selectorSelect();
	});

	/**
	 * Showing saved passwords in settings
	 */
	$('#settings-passwords-load').on('click', function () {
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

	$('#popup-video').on('loadeddata', function () {
		loadingDone(this);
	}).on('ended', function () {
		if (loadedStructure.presentationRunning) {
			presentationNext();
		}
	});

	$('#popup-audio').on('loadeddata', function () {
		loadingDone(this);
	}).on('ended', function () {
		if (loadedStructure.presentationRunning) {
			presentationNext();
		}
	});

	// loading is done when img is loaded
	$('#popup-image').on('load', function () {
		loadingDone(this);
	});

	$('#navbar').on('click', '#navbar-share', function (event) { // Event - share URL
		event.preventDefault();
		shareUrl(window.location.origin + '/#' + S.getCurrentFolder().url);
	}).on('click', '#navbar-favourites-add', function (event) { // Event - add to favourites
		event.preventDefault();
		favouritesAdd(S.getCurrentFolder().path);
	}).on('click', '#navbar-favourites-remove', function (event) { // Event - remove from favourites
		event.preventDefault();
		favouritesRemove(S.getCurrentFolder().path);
	});

	// Event - load next item if possible
	$('#popup-next, #popup-footer-next').on('click', function () {
		itemNext(false); // dont stop presentation mode
	});
	// Event - load previous item if possible
	$('#popup-prev, #popup-footer-prev').on('click', function () {
		itemPrev(true);
	});

	// Event - share file url from popup
	$('#popup-share').on('click', function () {
		shareUrl(window.location.origin + '/#' + S.getCurrentFile().url);
	});

	$('#modal-settings').on('show.bs.modal', function () {
		loadedStructure.settings = true;
	}).on('hidden.bs.modal', function () {
		loadedStructure.settings = false;
	});
});

function popupOpen() {
	loadedStructure.popup = true;
	$('#popup').fadeIn(Settings.load('animationSpeed'));
}

function popupClose() {
	$('#popup').fadeOut(Settings.load('animationSpeed'));
	// This will prevent waiting (promise) on re-opening popup window:
	// animation in promise will skip if elements are already faded out
	$('#popup-video').fadeOut(Settings.load('animationSpeed')).promise();
	$('#popup-audio').fadeOut(Settings.load('animationSpeed')).promise();
	$('#popup-image').fadeOut(Settings.load('animationSpeed')).promise();
	loadedStructure.popup = false;
	window.location.hash = S.getCurrentFolder().url;
	videoPause();
	audioPause();
	presentationStop();
}

function presentationIsLast() {
	return S.getNextFile(S.getCurrentFile().index) === null;
}

function presentationNext() {
	if (presentationIsLast()) {
		presentationStop();
		return;
	}
	itemNext(false);
}

function presentationStart() {
	if (presentationIsLast()) {
		return; // there are no more items to go so dont even start the presentation
	}
	$('#popup-footer-presentation-stop').show();
	$('#popup-footer-presentation-start').hide();
	loadedStructure.presentationRunning = true;
	// if video, first play it
	if (S.getCurrentFile().isVideo) {
		videoPlay();
	} else if (S.getCurrentFile().isAudio) {
		audioPlay();
	} else {
		itemNext(false);
	}
}

function presentationStop() {
	$('#popup-footer-presentation-start').show();
	$('#popup-footer-presentation-stop').hide();
	loadedStructure.presentationRunning = false;
	presentationClearTimeout();
}

function presentationClearTimeout() {
	clearTimeout(loadedStructure.presentationIntervalId);
}

function presentationToggle() {
	if (loadedStructure.presentationRunning) {
		presentationStop();
	} else {
		presentationStart();
	}
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
	const currentFolderPath = S.getCurrentFolder().path;
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
		$('#button-login').hide();
		$('#button-logout').show();
		$('#dynamic-styles').text('.logged-in {display: inherit;} .logged-out {display: none;}');
	} else {
		$('#button-login').show();
		$('#button-logout').hide();
		$('#dynamic-styles').text('.logged-out {display: inherit;} .logged-in {display: none;}');
	}
}

function loadSearch(callback) {
	let query = $('#navbar-filter input').val().trim();
	if (!query) {
		console.log("Search query is empty, cancel search request");
		return;
	}
	$.ajax({
		url: '/api/search',
		method: 'GET',
		data: {
			path: btoa(encodeURIComponent(S.getCurrentFolder().path)),
			query: query
		},
		success: function (result) {
			if (result.error === true || !result.result) {
				flashMessage(result.message || 'Chyba během hledání. Kontaktuj autora.', 'danger', false);
			} else {
				parseStructure(result.result);
				S.selectorMove('first');
			}
		},
		error: function (result) {
			flashMessage(result.responseJSON ? result.responseJSON.message : 'Chyba během hledání. Kontaktuj autora.', 'danger', false);
		},
		beforeSend: function () {
			loadingStructure(true);
			$('#navbar-filter .search i.fa').addClass('fa-circle-o-notch fa-spin').removeClass('fa-search');
		},
		complete: function () {
			loadingStructure(false);
			$('#navbar-filter .search i.fa').removeClass('fa-circle-o-notch fa-spin').addClass('fa-search');
			(typeof callback === 'function' && callback());
		}
	});
}

function loadStructure(force, callback) {
	// in case of triggering loading the same structure again (already loaded), skip it
	if (force !== true && loadedStructure.loadedFolder === S.getCurrentFolder().path) {
		console.log("Structure is already loaded, skip");
		return (typeof callback === 'function' && callback());
	}
	$.ajax({
		url: '/api/structure',
		method: 'GET',
		data: {
			path: btoa(encodeURIComponent(S.getCurrentFolder().path))
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
				$('#navbar-filter input').val('');
				S.filter();
			}
		},
		error: function (result) {
			flashMessage(result.responseJSON ? result.responseJSON.message : 'Serverová chyba během načítání dat. Kontaktuj autora.', 'danger', false);
		},
		beforeSend: function () {
			loadingStructure(true);
		},
		complete: function () {
			loadingStructure(false);
			(typeof callback === 'function' && callback());
		}
	});
}

function parseStructure(items) {
	// in case of triggering loading the same structure again (already loaded), skip it
	updateLoginButtons(); // might be logged out

	loadedStructure.loadedFolder = S.getCurrentFolder().path;
	S.setAll(items);
	const currentFolder = S.getCurrentFolder();
	let maxVisible = S.getItems().length;

	/**
	 * Generate breadcrumb urls in menu
	 */
	let breadcrumbHtml = '';
	breadcrumbHtml += '<li class="breadcrumb-item"><a href="#/" title="Go to root folder" data-toggle="tooltip"><i class="fa fa-home"></i></a></li>';
	let breadcrumbPath = '/';

	currentFolder.paths.forEach(function (folderName, index) {
		breadcrumbHtml += '<li class="breadcrumb-item"><a href="#' + (breadcrumbPath += currentFolder.urls[index] + '/') + '">' + folderName + '</a></li>';
	});

	favouritesGenerateMenu();

	$('#currentPath').html(breadcrumbHtml);
	/**
	 * Generate structure content (rows based)
	 */
	let contentRows = '';
	contentRows += '<table class="table-striped table-condensed"><thead>';
	contentRows += ' <tr>';
	contentRows += '  <th>&nbsp;</th>';
	contentRows += '  <th>Název</th>';
	if (S.getFiles().length) {
		contentRows += '  <th>Velikost</th>';
		contentRows += '  <th>Datum</th>';
	}
	contentRows += ' </tr>';
	contentRows += '</thead><tbody>';
	S.getFolders().forEach(function (item) {
		if (item.noFilter) {
			maxVisible--;
		}
		contentRows += '<tr data-type="folder" class="item-index-' + item.index + '" data-index="' + item.index + '">';
		contentRows += ' <td><i class="fa fa-' + item.icon + ' fa-fw"></i></td>';
		contentRows += ' <td><a href="#' + item.url + '">' + item.text + '</a></td>';
		if (S.getFiles().length) {
			contentRows += ' <td>&nbsp;</td>';
			contentRows += ' <td>&nbsp;</td>';
		}
		contentRows += '</tr>';
	});
	if (items.foldersTotal > items.folders.length) {
		contentRows += '<tr class="structure-limited" data-type="folder">';
		contentRows += '<td><i class="fa fa-info fa-fw"></i></td>';
		contentRows += '<td colspan="' + (S.getFiles().length ? '3' : '1') + '">Celkem je zde ' + (items.foldersTotal) + ' složek ale z důvodu rychlosti jsou některé skryty. Limit můžeš ovlivnit v nastavení.</td>';
		contentRows += '</tr>';
	}
	S.getFiles().forEach(function (item) {
		contentRows += '<tr data-type="file" class="item-index-' + item.index + '" data-index="' + item.index + '">';
		contentRows += '<td><i class="fa fa-' + item.icon + ' fa-fw"></i></td>';
		contentRows += '<td><a href="#' + item.url + '">' + item.text + '</a></td>';
		contentRows += '<td>' + formatBytes(item.size, 2) + '</td>';
		const created = item.created.human(true);
		contentRows += '<td title="' + created + '<br>Před ' + msToHuman(new Date() - item.created) + '" data-toggle="tooltip">' + created.date + ' <span>' + created.time + '</span></td>';
		contentRows += '</tr>';
	});
	if (maxVisible === 0) {
		contentRows += '<tr class="structure-back" data-type="folder">';
		contentRows += '<td><i class="fa fa-info fa-fw"></i></td>';
		contentRows += '<td colspan="' + (S.getFiles().length ? '3' : '1') + '">Složka je prázdná.</td>';
		contentRows += '</tr>';
	}
	if (items.filesTotal > items.files.length) {
		contentRows += '<tr class="structure-limited" data-type="folder">';
		contentRows += '<td><i class="fa fa-info fa-fw"></i></td>';
		contentRows += '<td colspan="' + (S.getFiles().length ? '3' : '1') + '">Celkem je zde ' + (items.filesTotal) + ' souborů ale z důvodu rychlosti jsou některé skryty. Limit můžeš ovlivnit v nastavení.</td>';
		contentRows += '</tr>';
	}
	contentRows += '</tbody></table>';

	/**
	 * Generate structure content (tiles based)
	 */
	let contentTiles = '';
	// contentTiles += '<div class="d-flex flex-wrap">';
	contentTiles += '<div id="structure-tiles">';
	S.getFolders().forEach(function (item) {
		if (item.noFilter) {
			maxVisible--;
		}
		contentTiles += '<a href="#' + item.url + '" class="structure-item item-index-' + item.index + '" data-type="folder" data-index="' + item.index + '">';
		contentTiles += ' <span class="structure-tile-item-name"><i class="fa fa-' + item.icon + ' fa-fw"></i>' + item.text + '</span>';
		contentTiles += '</a>';
	});
	// if (items.foldersTotal > items.folders.length) {
	// 	contentTiles += '<tr class="structure-limited" data-type="folder">';
	// 	contentTiles += '<td><i class="fa fa-info fa-fw"></i></td>';
	// 	contentTiles += '<td colspan="' + (S.getFiles().length ? '3' : '1') + '">Celkem je zde ' + (items.foldersTotal) + ' složek ale z důvodu rychlosti jsou některé skryty. Limit můžeš ovlivnit v nastavení.</td>';
	// 	contentTiles += '</tr>';
	// }
	S.getFiles().forEach(function (item) {
		const style = (item.isImage === true) ? 'background-image: url(' + (item.getFileUrl() + '&width=200&height=200&fit=cover') + ')' : '';
		contentTiles += '<a href="#' + item.url + '" class="structure-item item-index-' + item.index + '" data-type="file" data-index="' + item.index + '" style="' + style + '">';
		contentTiles += ' <span class="structure-tile-item-name"><i class="fa fa-' + item.icon + ' fa-fw"></i>' + item.text + '</span>';
		contentTiles += '</a>';
	});
	// if (maxVisible === 0) {
	// 	contentTiles += '<tr class="structure-back" data-type="folder">';
	// 	contentTiles += '<td><i class="fa fa-info fa-fw"></i></td>';
	// 	contentTiles += '<td colspan="' + (S.getFiles().length ? '3' : '1') + '">Složka je prázdná.</td>';
	// 	contentTiles += '</tr>';
	// }
	// if (items.filesTotal > items.files.length) {
	// 	contentTiles += '<tr class="structure-limited" data-type="folder">';
	// 	contentTiles += '<td><i class="fa fa-info fa-fw"></i></td>';
	// 	contentTiles += '<td colspan="' + (S.getFiles().length ? '3' : '1') + '">Celkem je zde ' + (items.filesTotal) + ' souborů ale z důvodu rychlosti jsou některé skryty. Limit můžeš ovlivnit v nastavení.</td>';
	// 	contentTiles += '</tr>';
	// }
	contentTiles += '</div>';

	$('#structure').html(contentTiles);
	$('#navbar-filter .total').text(maxVisible);
	$('#navbar-filter .filtered').text(maxVisible);
}

function loadingStructure(loading) {
	if (loading === true) {
		// add loading icon to specific item in structure
		$('.structure-selected td:nth-child(2) a').prepend('<i class="fa fa-circle-o-notch fa-spin"></i> ');
		$('#navbar-filter .filtered').html('<i class="fa fa-circle-o-notch fa-spin"></i>');
		$('#navbar-filter .total').html('<i class="fa fa-circle-o-notch fa-spin"></i>');
		$('#navbar-filter input').prop('disabled', true);
		$('#navbar-filter .search').prop('disabled', true);
	}
	if (loading === false) {
		$('#map').hide();
		// new structure will override loading icon but remove it manually in case of error
		$('.structure-selected td:nth-child(2) a i').remove();
		$('#navbar-filter input').prop('disabled', false);
		$('#navbar-filter .search').prop('disabled', false);
		$('[data-toggle="tooltip"]').tooltip({html: true}); // update all tooltips after structure is (re)loaded
	}
}

function loadingPopup(loading) {
	if (loading === true) {
		loadedStructure.loading = true;
		$('#popup-loading').show();
	}
	if (loading === false) {
		loadedStructure.loading = false;
		$('#popup-loading').hide();
		$('[data-toggle="tooltip"]').tooltip();
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
	let html = '<div class="alert alert-' + type + '" id="alert' + loadedStructure.flashIndex + '" role="alert">';
	html += '<button class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>' + text + '</div>';
	$(target).prepend(html);
	if (fade !== false) {
		$('#alert' + loadedStructure.flashIndex).delay(fade).fadeOut("slow", function () {
			$(this).remove();
		});
	}
	loadedStructure.flashIndex++;
}

function mapInit() {
	mapData.map = new google.maps.Map(document.getElementById('map'), {
		zoom: 7,
		center: new google.maps.LatLng(49.6, 15.2), // Czechia
	});
	console.log("map loaded");

	// init info window
	mapData.infoWindow = new google.maps.InfoWindow({
		content: 'Nastala chyba'
	});
}

/**
 * Put loaded photos into google maps
 *
 * Note: Because of asynchronous loading both structure data and Google maps,
 * putting markers into map must wait until maps are fully loaded. This is done by
 * by periodic checking. After detecting, that map are already loaded, interval is stopped
 */
function mapParsePhotos() {
	let loadMapIntervalId = null;

	function updateMapData() {
		if (mapData.map === null) {
			return; // try again later
		} else { // map is loaded, stop interval
			clearInterval(loadMapIntervalId);
		}
		let showMap = false;
		mapData.mapBounds = new google.maps.LatLngBounds();
		// remove old markers
		$.each(mapData.markers.photos, function (index, data) {
			data.setMap(null);
			delete mapData.markers.photos[index];
		});
		// create new markers and insert them into map
		S.getFiles().forEach(function (item) {
			if (item.coordLat && item.coordLon) {
				$('#map').show();
				showMap = true; // at least one item has coordinates
				mapData.markers.photos[item.index] = new google.maps.Marker({
					map: mapData.map,
					position: {lat: item.coordLat, lng: item.coordLon},
					title: item.text,
					icon: 'images/marker-photo.png',
					// animation: google.maps.Animation.DROP,
				});
				// Show infoWindow
				mapData.markers.photos[item.index].addListener('click', function () {
					const link = 'https://www.google.cz/maps/place/' + item.coordLat + ',' + item.coordLon;
					mapData.infoWindow.setContent('<div id="map-info-window"><div>' +
						'<button onClick="S.selectorMove(' + item.index + '); S.selectorSelect();" style="width: 100%" class="btn btn-primary btn-sm">' + item.text + '</button>' +
						'<b>Souřadnice:</b> ' +
						'<a href="' + link + '" target="_blank" title="Google maps">' + item.coordLat + ', ' + item.coordLon + '</a>' +
						'</div></div>');
					mapData.infoWindow.open(mapData.map, this);
				});

				mapData.mapBounds.extend(mapData.markers.photos[item.index].position);
			}
		});
		mapData.map.fitBounds(mapData.mapBounds);
		// there is nothing to show on the map so disable it
		if (showMap === false) {
			$('#map').hide();
		} else {
			// open InfoWindow in map if currently opened Item is FileItem with coordinates (marker)
			const item = S.historyGet().last();
			if (item) {
				const marker = mapData.markers.photos[item.index];
				if (marker) {
					new google.maps.event.trigger(marker, 'click');
				}
			}
		}
	}

	// try to load map
	updateMapData();
	// start checking if map can be loaded
	loadMapIntervalId = setInterval(function () {
		updateMapData();
	}, 100);
}

function shareUrl(niceUrl) {
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