/* global Settings */
var loadedStructure = {
	loadedFolder: '', // default is loaded nothing
	popup: false, // Is popup visible?
	settings: false, // is settings modal visible?
	filtering: false,
	flashIndex: 0, // incremental index used for flashMessage()
	presentationRunning: false,
	presentationIntervalId: null,
};

const S = new Structure();

function loadAndResize() {
	// resize image in popup to fit the screen
	$('#popup')
		.css('height', window.innerHeight - $('#popup-footer').outerHeight())
		.css('width', window.innerWidth);
	$('#popup-content')
		.css('max-height', window.innerHeight - $('#popup-footer').outerHeight())
		.css('max-width', window.innerWidth);
}

$(window).on('resize', function () {
	loadAndResize();
});

$('#popup-video').on('loadeddata', function () {
	loadingDone(this);
	$(this).fadeIn(Settings.load('animationSpeed'), function () {
		loadingPopup(false);
	});
});

// loading is done when img is loaded
$('#popup-image').load(function () {
	loadingDone(this);
});

function loadingDone(element) {
	console.log(element);
	if (element) {
		$(element).fadeIn(Settings.load('animationSpeed'), function () {
			loadingPopup(false);
		});
		if (loadedStructure.presentationRunning) {
			if ('#' + S.currentPath === $('#popup-next').attr('href')) { // last item
				$('#popup-footer-presentation')[0].click(); // Stop presentation mode
				return;
			}
			loadedStructure.presentationIntervalId = setTimeout(function () {
				$('#popup-next')[0].click();
			}, Settings.load('presentationSpeed'));
		}
		// Bug: exifdata is cached and will not change if img src is changed
		// Delete cached exifdata. @Author: https://github.com/exif-js/exif-js/issues/163#issuecomment-412714098
		delete element.exifdata;
		EXIF.getData(element, function () {
			try {
				exifTags = EXIF.getAllTags(element);
				coords = {
					lat: convertDMSToDD(exifTags['GPSLatitude'][0], exifTags['GPSLatitude'][1], exifTags['GPSLatitude'][2], exifTags['GPSLatitudeRef']),
					lon: convertDMSToDD(exifTags['GPSLongitude'][0], exifTags['GPSLongitude'][1], exifTags['GPSLongitude'][2], exifTags['GPSLongitudeRef']),
				};
				$('#popup-location').attr('href', 'https://www.google.cz/maps/place/' + coords['lat'] + ',' + coords['lon']).show();
			} catch (error) {
				// Exif data is probably missing
			}
		});
	} else {
		loadingPopup(false);
	}
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
	var text = "Error: " + msg + "\nurl: " + url + "\nline: " + line + extra;
	// Report and save error on server
	$.post('/api/report', {type: 'javascript', 'raw': text});
	alert('Nastala neočekávaná chyba. Pokud se opakuje, udělej screenshot obrazovky a kontaktuj správce.\n' + text);
	// If you return true, then error alerts (like in older versions of Internet Explorer) will be suppressed.
	return true;
};

// If hash is changed, something is being loaded (image of folder)
$(window).on('hashchange', function (e) {
	S.setCurrent(window.location.hash);
	loadStructure(false, function () { // load folder structure
		// If selected item is file, open popup with image
		var currentFile = S.getCurrentFile();
		if (currentFile) { // loaded item is file
			loadingPopup(true); // starting loading img
			Promise.all([
				// Before continuing loading next item first has to hide previous,
				// otherwise while fading out it will flash new item
				$('#popup-video').fadeOut(Settings.load('animationSpeed')).promise(),
				$('#popup-image').fadeOut(Settings.load('animationSpeed')).promise(),
				$('#popup-icon').fadeOut(Settings.load('animationSpeed')).promise(),
			]).then(function () {
				S.selectorMove(currentFile.index); // highlight loaded image
				$('#popup-location').hide();

				let openUrl = S.getFileUrl(currentFile.index);
				let downloadUrl = S.getFileUrl(currentFile.index, true);
				if (!openUrl) { // If item has no view url, use icon to indicate it is file that has to be downloaded
					openUrl = downloadUrl;
					$('#popup-icon').removeClass().addClass('fa fa-5x fa-' + currentFile.icon);
					$('#popup-icon').fadeIn(Settings.load('animationSpeed'), function () {
						loadingPopup(false);
					});
				}
				$('#popup-filename').text(currentFile.paths.last()).attr('href', openUrl);
				$('#popup-filename').attr('title', currentFile.path); // @TODO convert to tooltip
				$('#popup-download').attr('href', downloadUrl);
				popupOpen();
				if (currentFile.isImage) {
					$('#popup-image').attr('src', S.getFileUrl(currentFile.index));
					// fade in animation is triggered on image load
				} else if (currentFile.isVideo) {
					$('#popup-video source').attr('src', S.getFileUrl(currentFile.index));
					$('#popup-video').load();
				} else {
					loadingDone()
				}

				// @TODO upgrade counter to respect filter
				$('#popup-counter').text((currentFile.index + 1 - S.getFolders().length) + '/' + S.getFiles().length);

				// generate URL for previous file buttons
				let prevFile = S.getPrevious(currentFile.index);
				let prevFileUrl = currentFile.path; // default is current file (do nothing)
				if (prevFile && prevFile.isFile) { // if there is some previous file
					prevFileUrl = prevFile.path;
				}
				$('#popup-footer-prev').attr('href', '#' + prevFileUrl);
				$('#popup-prev').attr('href', '#' + prevFileUrl);

				// generate URL for next file buttons
				let nextFile = S.getNext(currentFile.index);
				let nextFileUrl = currentFile.path; // default is current file (do nothing)
				if (nextFile && nextFile.isFile) { // if there is some next file
					nextFileUrl = nextFile.path;
				}
				$('#popup-footer-next').attr('href', '#' + nextFileUrl);
				$('#popup-next').attr('href', '#' + nextFileUrl);
			})
		} else { // If selected item is folder, load structure of that folder
			popupClose();
			var previousPath = decodeURI(e.originalEvent.oldURL.split('#')[1]); // get previous path
			var item = S.getByName(previousPath);
			if (item) { // founded = going back
				S.selectorMove(item.index);
			} else { // going to new folder, select first item
				S.selectorMove('first');
			}
		}
	});
});

$(function () {
	loadAndResize();
	updateLoginButtons();
	favouritesGenerateMenu();
	// If is set redirect, load this
	if (Cookies.get('pmg-redirect')) {
		window.location.hash = Cookies.get('pmg-redirect');
		Cookies.remove('pmg-redirect');
	}
	// If not set hash, load url from last time
	if (!window.location.hash && Settings.load('hashBeforeUnload')) {
		window.location.hash = Settings.load('hashBeforeUnload');
	} else {
		window.dispatchEvent(new HashChangeEvent("hashchange"));
	}
	S.setCurrent(window.location.hash);
	$('[data-toggle="tooltip"]').tooltip();
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
	$('#popup-close, #popup-content').on('click', function (event) {
		popupClose();
	});
	$('#filter .search').on('click', function (event) {
		event.preventDefault();
		loadSearch();
	});

	$('#popup-footer-presentation').on('click', function (event) {
		if ($('#popup-footer-presentation-play').is(":visible")) {
			$('#popup-footer-presentation-stop').show();
			$('#popup-footer-presentation-play').hide();
			loadedStructure.presentationRunning = true;
			$('#popup-next')[0].click();
		} else {
			$('#popup-footer-presentation-play').show();
			$('#popup-footer-presentation-stop').hide();
			loadedStructure.presentationRunning = false;
			clearTimeout(loadedStructure.presentationIntervalId);
		}
	});

	// Fill form settings with values from Settings class
	// @TODO upgrade to works with all types of inputs (text, number, radio, checkbox...)
	// type=number
	$('#form-settings input[type=number]').each(function () {
		let settingsName = $(this).attr('name');
		$(this).val(Settings.load(settingsName));
	});
	// type=radio
	$('#form-settings input[type=radio]').each(function () {
		let settingsName = $(this).attr('name');
		let settingsValue = Settings.load(settingsName);
		if ($(this).val() === settingsValue) {
			$(this).prop("checked", true);
		}
	});

	// Save form values to Settings class
	$('#form-settings').on('submit', function (event) {
		event.preventDefault();
		var values = $(this).serializeArray();
		values.forEach(function (input) {
			Settings.save(input.name, input.value)
		});
		$('#settings-save').html('Uloženo <i class="fa fa-check"></i>').addClass('btn-success').removeClass('btn-primary').prop('disabled', true);
		setTimeout(function () {
			$('#settings-save').html('Uložit').removeClass('btn-success').addClass('btn-primary').prop('disabled', false);
		}, 2000);
	});
	// Set text into dropdown menu according enabled theme
	if (Settings.load('theme') === 'dark') {
		$('#settings-toggle-theme span').text('Rozsvítit');
	}
	/**
	 * Toggle dark theme
	 */
	$('#settings-theme input').on('click', function (event) {
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
		return;
	});

	/**
	 * Showing saved passwords in settings
	 */
	$('#settings-passwords-load').on('click', function (event) {
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
					htmlPasswords.push('<a href="#' + perm + '">' + perm + '</a>');
				});
				html += '<p>' + htmlPasswords.join('<br>') + '</p>';
				$('#settings-passwords-list').append(html);
			});
		}).fail(function(response) {
			flashMessage('danger', 'Error <b>' + response.status + '</b> while loading passwords: <b>' + response.statusText + '</b>');
		}).always(function() {
			setTimeout(function () {
				$(button).html('Načíst hesla').prop('disabled', false);
			}, 500);
		});
	});

	// Event - add to favourites
	$('#currentPath').on('click', '#breadcrumb-favourite.fa-star-o', function () {
		favouritesAdd($(this).data('path'));
		$(this).addClass('fa-star').removeClass('fa-star-o');
		$(this).attr('title', 'Odebrat z oblíbených');
	});
	// Event - remove from favourites
	$('#currentPath').on('click', '#breadcrumb-favourite.fa-star', function () {
		favouritesRemove($(this).data('path'));
		$(this).addClass('fa-star-o').removeClass('fa-star');
		$(this).attr('title', 'Přidat do oblíbených');
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
	$('#popup-image').fadeOut(Settings.load('animationSpeed')).promise();
	loadedStructure.popup = false;
	window.location.hash = S.getCurrentFolder();
	videoPause();
}

function favouritesAdd(path) {
	let saved = Settings.load('favouriteFolders');
	saved.pushUnique(path);
	flashMessage('info', 'Folder has been added to favourites. Check <i class="fa fa-bars fa-fw"></i> menu.');
	Settings.save('favouriteFolders', saved);
	favouritesGenerateMenu();
}
function favouritesRemove(path) {
	let saved = Settings.load('favouriteFolders');
	saved.removeByValue(path);
	flashMessage('info', 'Folder "' + path + '" has been removed from favourites.');
	Settings.save('favouriteFolders', saved);
	favouritesGenerateMenu();
}
function favouritesIs(path) {
	return (Settings.load('favouriteFolders').indexOf(path) >= 0)
}
function favouritesGenerateMenu() {
	$('#navbar-hamburger-dropdown .dropdown-menu .favourites-submenu').remove();
	var saved = Settings.load('favouriteFolders');
	if (saved.length > 0) {
		$('#navbar-hamburger-dropdown .dropdown-menu').append('<div class="dropdown-divider favourites-submenu"></div>');
	}
	saved.forEach(function(savedFolder) {
		$('#navbar-hamburger-dropdown .dropdown-menu').append(
			'<a class="dropdown-item favourites-submenu" href="#' + savedFolder + '">' + savedFolder + ' <i class="fa fa-fw fa-star"></i></a>'
		);
	});
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
function updateLoginButtons() {
	if (Cookies.get('google-login')) { // logged in
		$('#button-login').hide();
		$('#button-logout').show();
		$('#navbar .dropdown .dropdown-toggle i').addClass('fa-user').removeClass('fa-bars');
	} else {
		$('#button-login').show();
		$('#button-logout').hide();
		$('#navbar .dropdown .dropdown-toggle i').addClass('fa-bars').removeClass('fa-user');
	}
}
function loadSearch(callback) {
	var query = $('#filter input').val().trim();
	if (!query) {
		console.log("Search query is empty, cancel search request");
		return;
	}
	$.ajax({
		url: '/api/search',
		method: 'GET',
		data: {
			path: btoa(encodeURIComponent(S.getCurrentFolder())),
			query: query
		},
		success: function (result) {
			if (result.error === true || !result.result) {
				alert((result.message || 'Chyba během hledání. Kontaktuj autora.'));
			} else {
				parseStructure(result.result);
				S.selectorMove('first');
			}
		},
		error: function () {
			alert('Chyba během načítání dat. Kontaktuj autora.');
		},
		beforeSend: function () {
			loadingStructure(true);
			$('#filter .search i.fa').addClass('fa-circle-o-notch fa-spin').removeClass('fa-search');
		},
		complete: function () {
			loadingStructure(false);
			$('#filter .search i.fa').removeClass('fa-circle-o-notch fa-spin').addClass('fa-search');
			(typeof callback === 'function' && callback());
		}
	});
}
function loadStructure(force, callback) {
// in case of triggering loading the same structure again (already loaded), skip it
	if (force !== true && loadedStructure.loadedFolder === S.getCurrentFolder()) {
		console.log("Structure is already loaded, skip");
		return (typeof callback === 'function' && callback());
	}
	$.ajax({
		url: '/api/structure',
		method: 'GET',
		data: {
			path: btoa(encodeURIComponent(S.getCurrentFolder()))
		},
		success: function (result) {
			if (result.error === true || !result.result) {
				flashMessage('danger', (
					(result.message || 'Chyba během načítání dat. Kontaktuj autora.') +
					'<br>Zkus se <a href="/login" class="alert-link">přihlásit</a> nebo jít <a href="#" class="alert-link">domů</a>.'
					), false
				);
			} else {
				$('#structure-header').html(result.result.header || '');
				$('#structure-footer').html(result.result.footer || '');
				parseStructure(result.result);
				$('#filter input').val('');
				S.filter();
			}
		},
		error: function () {
			flashMessage('danger', (result.message || 'Serverová chyba během načítání dat. Kontaktuj autora.'), false);
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
	var limited = false;
	var realTotal = items.folders.length + items.files.length;
	if (Settings.load('structureItemLimit') > 0 && realTotal >= Settings.load('structureItemLimit')) {
		limited = true;
		if (items.folders.length > Settings.load('structureItemLimit')) {
			items.folders = items.folders.slice(0, Settings.load('structureItemLimit'));
		}
		if (items.files.length > Settings.load('structureItemLimit')) {
			items.files = items.files.slice(0, Settings.load('structureItemLimit'));
		}
	}
	loadedStructure.loadedFolder = S.getCurrentFolder();
	S.setAll(items);
	var maxVisible = S.getItems().length;
	// Full path as breadcrumb in header (home / folder / in / another / folder)
	var breadcrumbHtml = '';
	breadcrumbHtml += '<li class="breadcrumb-item"><a href="#/"><i class="fa fa-home"></i></a></li>';
	var breadcrumbPath = '/';
	S.getCurrentFolder(true).forEach(function (folderName) {
		if (folderName) {
			breadcrumbHtml += '<li class="breadcrumb-item"><a href="#' + (breadcrumbPath += folderName + '/') + '">' + decodeURI(folderName) + '</a></li>';
		}
	});
	if (S.getCurrentFolder() !== '/') { // show only in non-root folders
		let icon = favouritesIs(S.getCurrentFolder()) ? 'fa-star' : 'fa-star-o';
		let title = favouritesIs(S.getCurrentFolder()) ? 'Odebrat z oblíbených' : 'Přidat do oblíbených';
		breadcrumbHtml += '<li><a id="breadcrumb-favourite" class="fa fa-fw ' + icon + '" data-path="' + S.getCurrentFolder() + '" title="' + title + '"></a></li>';
	}
	$('#currentPath').html(breadcrumbHtml);
	var content = '';
	content += '<table class="table-striped table-condensed"><thead>';
	content += ' <tr>';
	content += '  <th>&nbsp;</th>';
	content += '  <th>Název</th>';
	if (S.getFiles().length) {
		content += '  <th>Velikost</th>';
		content += '  <th>Datum</th>';
	}
	content += ' </tr>';
	content += '</thead><tbody>';
	S.getFolders().forEach(function (item) {
		if (item.noFilter) {
			maxVisible--;
		}
		content += '<tr data-type="folder" data-index="' + item.index + '">';
		content += ' <td><i class="fa fa-' + item.icon + ' fa-fw"></i></td>';
		content += ' <td><a href="#' + item.path + '">' + (item.displayText || item.paths.last()).escapeHtml() + '</a></td>';
		if (S.getFiles().length) {
			content += ' <td>&nbsp;</td>';
			content += ' <td>&nbsp;</td>';
		}
		content += '</tr>';
	});
	S.getFiles().forEach(function (item) {
		content += '<tr data-type="file" data-index="' + item.index + '">';
		content += '<td><i class="fa fa-' + item.icon + ' fa-fw"></i></td>';
		content += '<td><a href="#' + item.path + '">' + (item.displayText || item.paths.last()).escapeHtml() + '</a></td>';
		content += '<td>' + formatBytes(item.size, 2) + '</td>';
		let created = item.created.human(true);
		content += '<td title="' + created + '\nPřed ' + msToHuman(new Date() - item.created) + '">' + created.date + ' <span>' + created.time + '</span></td>';
		content += '</tr>';
	});
	if (maxVisible === 0) {
		content += '<tr class="structure-back" data-type="folder">';
		content += '<td><i class="fa fa-info fa-fw"></i></td>';
		content += '<td colspan="' + (S.getFiles().length ? '3' : '1') + '">Složka je prázdná.</td>';
		content += '</tr>';
	}
	if (limited) {
		content += '<tr class="structure-limited" data-type="folder">';
		content += '<td><i class="fa fa-info fa-fw"></i></td>';
		content += '<td colspan="' + (S.getFiles().length ? '3' : '1') + '">Celkem je zde ' + (realTotal) + ' položek ale z důvodu rychlosti jsou některé skryty. Limit můžeš ovlivnit v nastavení.</td>';
		content += '</tr>';
	}
	content += '</tbody></table>';
	$('#structure').html(content);
	$('#filter .total').text(maxVisible);
	$('#filter .filtered').text(maxVisible);
}

function loadingStructure(loading) {
	if (loading === true) {
		// add loading icon to specific item in structure
		$('.structure-selected td:nth-child(2) a').prepend('<i class="fa fa-circle-o-notch fa-spin"></i> ');
		$('#filter .filtered').html('<i class="fa fa-circle-o-notch fa-spin"></i>');
		$('#filter .total').html('<i class="fa fa-circle-o-notch fa-spin"></i>');
		$('#filter input').prop('disabled', true);
		$('#filter .search').prop('disabled', true);
	}
	if (loading === false) {
		// new structure will override loading icon but remove it manually in case of error
		$('.structure-selected td:nth-child(2) a i').remove();
		$('#filter input').prop('disabled', false);
		$('#filter .search').prop('disabled', false);
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
	}
	return loadedStructure.loading;
}

function flashMessage(type, text, fade = 4, target = '#flash-message')
{
	let html = '<div class="alert alert-' + type + '" id="alert' + loadedStructure.flashIndex + '" role="alert">';
	html += '<button class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>' + text + '</div>';
	$(target).prepend(html);
	if (fade !== false) {
		$('#alert' + loadedStructure.flashIndex).delay(fade * 1000).fadeOut("slow", function () {
			$(this).remove();
		});
	}
	loadedStructure.flashIndex++;
}
