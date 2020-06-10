function isTilesView() {
	return (Settings.load('structureDisplayType').includes('tiles'));
}
function isFilterFocused() {
	return $("#navbar-filter input").is(":focus");
}
jwerty.key('up', function (e) {
	if (loadedStructure.settings) {

	} else {
		e.preventDefault();
		if (loadedStructure.popup) {
			itemPrev(true);
		} else {
			if (isTilesView()) {
				for (let i = 0; i < getTilesCount(); i++) {
					S.selectorMove('up');
				}
			} else {
				S.selectorMove('up');
			}
		}
	}
});

jwerty.key('left', function (e) {
	if (isFilterFocused()) {

	} else if (loadedStructure.settings) {

	} else if (loadedStructure.popup) {
		itemPrev(true);
	} else {
		if (isTilesView()) {
			S.selectorMove('up');
		}
	}
});

jwerty.key('down', function (e) {
	if (loadedStructure.settings) {

	} else {
		e.preventDefault();
		if (loadedStructure.popup) {
			itemNext(false);
		} else {
			if (isTilesView()) {
				for (let i = 0; i < getTilesCount(); i++) {
					S.selectorMove('down');
				}
			} else {
				S.selectorMove('down');
			}
		}
	}
});

jwerty.key('right', function (e) {
	if (isFilterFocused()) {

	} else if (loadedStructure.settings) {

	} else if (loadedStructure.popup) {
		e.preventDefault();
		itemNext(false);
	} else {
		if (isTilesView()) {
			S.selectorMove('down');
		}
	}
});

jwerty.key('home', function (e) {
	if (isFilterFocused()) {

	} else if (loadedStructure.settings) {

	} else {
		e.preventDefault();
		S.selectorMove('first');
		if (loadedStructure.popup) {
			itemPrev(true); // it will automatically find first file and opens it
		}
	}
});

jwerty.key('page-up', function (e) {
	if (loadedStructure.settings) {

	} else {
		e.preventDefault();
		if (loadedStructure.popup) {
			itemPrev10(true);
		} else {
			const moveBy = isTilesView() ? (getTilesCount() * 4) : 10;
			for (let i = 0; i < moveBy; i++) {
				S.selectorMove('up');
			}
		}
	}
});

jwerty.key('page-down', function (e) {
	if (loadedStructure.settings) {

	} else {
		e.preventDefault();
		if (loadedStructure.popup) {
			itemNext10(false);
		} else {
			const moveBy = isTilesView() ? (getTilesCount() * 4) : 10;
			for (let i = 0; i < moveBy; i++) {
				S.selectorMove('down');
			}
		}
	}
});

jwerty.key('end', function (e) {
	if (isFilterFocused()) {

	} else if (loadedStructure.settings) {

	} else {
		e.preventDefault();
		S.selectorMove('last');
		if (loadedStructure.popup) {
			itemNext(true);
		}
	}
});

jwerty.key('enter', function (e) {
	if (loadedStructure.settings) {
		$("#form-settings").submit();
	} else if (loadedStructure.popup) {
		if (S.getCurrentFile().isImage) {
			$('#popup-filename')[0].click();
		}
		// @TODO video open in fullscreen (also disable move left and right)
	} else {
		if ($("#navbar-filter .search").is(":focus")) {
			$('#navbar-filter .search').trigger('click');
		} else {
			S.selectorSelect();
		}
	}
});

jwerty.key('ctrl+enter', function (e) {
	if (loadedStructure.settings) {

	} else if (loadedStructure.popup) {

	} else {
		$('#navbar-filter .search').trigger('click');
	}
});

jwerty.key('space', function (e) {
	if (isFilterFocused()) {

	} else if (loadedStructure.settings) {

	} else if (loadedStructure.popup) {
		e.preventDefault(); // do not type in filter
		const currentFile = S.getCurrentFile();
		const focusedElementId = $(':focus').attr('id');
		if (currentFile.isVideo) {
			if (focusedElementId === 'popup-video') {
				// if video is focused, space keyboard is default browser binding to toggle video so do nothing
			} else {
				videoToggle();
			}
		} else if (currentFile.isAudio) {
			if (focusedElementId === 'popup-video') {
				// if audio is focused, space keyboard is default browser binding to toggle audio so do nothing
			} else {
				audioToggle();
			}
		} else if (currentFile.isImage) {
			// open file in new tab
			$('#popup-filename')[0].click();
		} else {
			// probably non-viewable file, do nothing
		}
	} else {
		// filter is focused, dont do anything special
	}
});

jwerty.key('ctrl+space', function (e) {
	if (loadedStructure.settings) {

	} else if (loadedStructure.popup) {
		presentation.toggle();
	} else {
		// filter is focused, dont do anything special
	}
});

jwerty.key('backspace', function (e) {
	if (isFilterFocused()) {

	} else if (loadedStructure.settings) {

	} else if (loadedStructure.popup) {
		e.preventDefault(); // do not delete text from filter
		popupClose();
	} else {

	}
});

jwerty.key('esc/ctrl+backspace/shift+backspace', function (e) {
	if (isFilterFocused()) {
		e.preventDefault();
		$("#navbar-filter input").trigger('blur');
	} else if (loadedStructure.settings) {

	} else if (loadedStructure.popup) {
		popupClose();
	} else { // go back
		let item = S.getFirst();
		if (item.text === '..') { // @HACK should be some property to recognize "go back"
			S.selectorMove(item.index);
			S.selectorSelect();
		}
	}
});
// Autofocus into input before start typing
$(window).on('keypress', function () {
	if (loadedStructure.settings) {

	} else if (loadedStructure.popup) {

	} else {
		$('#navbar-filter input').focus();
	}
});

let filterTimeout = null;
$('#navbar-filter input').on('keyup change', function (event) {
	// do not run filter if are used keys to move in structure
	if ([
		// undefined, // triggered on "change",
		37, 38, 39, 40, // left, up, right, down
		13, // enter
		27, // escape
		33, 34, // page-up, page-down
		35, 36, // end, home
		16, 17, 18, // shift, right alt, alt
		92, 93 // windows, context menu,
	].indexOf(event.keyCode) >= 0) {
		return;
	}
	$('#navbar-filter .filtered').html('<i class="fa fa-circle-o-notch fa-spin"></i>'); // @TODO in case of filtering, this "loading" might stuck
	// Run filter after a little bit of inactivity
	// @Author: https://schier.co/blog/2014/12/08/wait-for-user-to-stop-typing-using-javascript.html
	clearTimeout(filterTimeout);
	filterTimeout = setTimeout(function () {
		S.filter();
	}, 300); // @TODO this cooldown should be bigger when there is too many items to filter
});
