var loadedStructure = {
	loadedFolder: '', // default is loaded nothing
	popup: false, // Is popup visible?
	filtering: false,
};
var c = {
	fadeSpeed: 250
}

const S = new Structure();

function loadAndResize() {
	// resize image in popup to fit the screen
	$('#popup').css('height', window.innerHeight - $('#popup-footer').outerHeight());
	$('#popup').css('width', window.innerWidth);

	$('#popup-content').css('max-height', window.innerHeight - $('#popup-footer').outerHeight());
	$('#popup-content').css('max-width', window.innerWidth);
}

$(window).resize(function () {
	loadAndResize();
});
$('#popup-video').on('loadeddata', function () {
	$(this).fadeIn(Settings.load('animationSpeed'), function () {
		loadingPopup(false);
	});
});
// loading is done when img is loaded
$('#popup-image').load(function () {
	$(this).fadeIn(Settings.load('animationSpeed'), function () {
		loadingPopup(false);
	});
	// Bug: exifdata is cached and will not change if img src is changed
	// Delete cached exifdata. @Author: https://github.com/exif-js/exif-js/issues/163#issuecomment-412714098
	delete this.exifdata;
	EXIF.getData(this, function () {
		try {
			exifTags = EXIF.getAllTags(this);
			coords = {
				lat: convertDMSToDD(exifTags['GPSLatitude'][0], exifTags['GPSLatitude'][1], exifTags['GPSLatitude'][2], exifTags['GPSLatitudeRef']),
				lon: convertDMSToDD(exifTags['GPSLongitude'][0], exifTags['GPSLongitude'][1], exifTags['GPSLongitude'][2], exifTags['GPSLongitudeRef']),
			};
			$('#popup-location').attr('href', 'https://www.google.cz/maps/place/' + coords['lat'] + ',' + coords['lon']).show();
		} catch (error) {
			// Exif data is probably missing
		}
	});
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
	var extra = !col ? '' : '\ncolumn: ' + col;
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
			//@TODO - bug, when there is delay while opening popup.
			// But it works fine if moving to another item without closing popup
			Promise.all([
				// Before continuing loading next item first has to hide previous,
				// otherwise while fading out it will flash new item
				$('#popup-video').fadeOut(Settings.load('animationSpeed')).promise(),
				$('#popup-image').fadeOut(Settings.load('animationSpeed')).promise()
			]).then(function () {
				S.selectorMove(currentFile.index); // highlight loaded image
				$('#popup-location').hide();
				$('#popup-filename').text(currentFile.paths.last()).attr('href', S.getFileUrl(currentFile.index));
				$('#popup-filename').attr('title', currentFile.path); // @TODO convert to tooltip
				popupOpen();
				if (currentFile.isImage) {
					$('#popup-image').attr('src', S.getFileUrl(currentFile.index));
					// fade in animation is triggered on image load
				}
				if (currentFile.isVideo) {
					$('#popup-video source').attr('src', S.getFileUrl(currentFile.index));
					$('#popup-video').load();
				}

				// @TODO upgrade counter to respect filter
				$('#popup-counter').text((currentFile.index + 1 - S.getFolders().length) + '/' + S.getFiles().length);
				var prevFile = S.getPrevious(currentFile.index);
				if (prevFile && prevFile.isFile) {
					$('#popup-footer-prev').attr('href', '#' + prevFile.path);
					$('#popup-prev').attr('href', '#' + prevFile.path);
				} else {
					//@TODO get last file
				}
				var nextFile = S.getNext(currentFile.index);
				if (nextFile) {
					$('#popup-footer-next').attr('href', '#' + nextFile.path);
					$('#popup-next').attr('href', '#' + nextFile.path);
				} else {
					//@TODO get first file
				}
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
	// settings
	if (Cookies.get('settings-compress') === 'true') {
		$('#settings-compress').attr('checked', true);
	}
	$('#settings-compress').on('click', function (e) {
		Cookies.set('settings-compress', $(this).is(':checked'));
	});
	// Set text into dropdown menu according enabled theme
	if (Settings.load('theme') === 'dark') {
		$('#settings-toggle-theme span').text('Rozsvítit');
	}
	/**
	 * Toggle dark theme
	 */
	$('#settings-toggle-theme').on('click', function (event) {
		event.stopPropagation(); // disable closing dropdown menu
		event.preventDefault(); // disable a.href click
		let theme = Settings.load('theme');
		if (theme === 'default') {
			$(this).children('span').text('Rozsvítit');
			theme = Settings.save('theme', 'dark');
		} else {
			$(this).children('span').text('Zhasnout');
			theme = Settings.save('theme', 'default');
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
});
function popupOpen() {
	loadedStructure.popup = true;
	$('#popup').fadeIn(Settings.load('animationSpeed'));
}
function popupClose() {
	$('#popup').fadeOut(Settings.load('animationSpeed'));
	loadedStructure.popup = false;
	window.location.hash = S.getCurrentFolder();
	videoPause();
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
		$('#navbar .dropdown .dropdown-toggle i').addClass('fa-user').removeClass('fa-cog');
	} else {
		$('#button-login').show();
		$('#button-logout').hide();
		$('#navbar .dropdown .dropdown-toggle i').addClass('fa-cog').removeClass('fa-user');
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
				alert((result.message || 'Chyba během vytváření dat. Kontaktuj autora.'));
			} else {
				$('#structure-header').html(result.result.header || '')
				$('#structure-footer').html(result.result.footer || '')
				parseStructure(result.result);
				$('#filter input').val('');
				S.filter();
			}
		},
		error: function () {
			alert('Chyba během načítání dat. Kontaktuj autora.');
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
	var limit = 1000;
	var realTotal = items.folders.length + items.files.length;
	if (realTotal >= limit) {
		limited = true;
		if (items.folders.length > limit) {
			items.folders = items.folders.slice(0, limit);
		}
		if (items.files.length > limit) {
			items.files = items.files.slice(0, limit);
		}
	}
	loadedStructure.loadedFolder = S.getCurrentFolder();
	S.setAll(items);
	var maxVisible = S.getItems().length;
	// Cela cesta v hlaviccce
	var breadcrumbHtml = '';
	breadcrumbHtml += '<li class="breadcrumb-item"><a href="#/"><i class="fa fa-home"></i></a></li>';
	var breadcrumbPath = '/';
	S.getCurrentFolder(true).forEach(function (folderName) {
		if (folderName) {
			breadcrumbHtml += '<li class="breadcrumb-item"><a href="#' + (breadcrumbPath += folderName + '/') + ' ">' + decodeURI(folderName) + '</a></li>';
		}
	});
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
		content += '<td colspan="' + (S.getFiles().length ? '3' : '1') + '">Celkem je zde ' + (realTotal) + ' položek ale z důvodu rychlosti jsou některé skryty. Pro zobrazení, @TODO.</td>';
		content += '</tr>';
	}
	content += '</tbody></table>';
	$('#structure').html(content);
	$('#filter .total').text(maxVisible);
	$('#filter .filtered').text(maxVisible);
}

function loadingStructure(loading) {

	if (loading === true) {
		$('#filter .filtered').html('<i class="fa fa-circle-o-notch fa-spin"></i>');
		$('#filter .total').html('<i class="fa fa-circle-o-notch fa-spin"></i>');
		$('#filter input').prop('disabled', true);
		$('#filter .search').prop('disabled', true);
	}
	if (loading === false) {
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
