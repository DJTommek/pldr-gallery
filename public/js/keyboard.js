jwerty.key('up', function (e) {
	if (loadedStructure.settings) {

	} else {
		e.preventDefault();
		if (loadedStructure.popup) {
			itemPrev(true, true);
		} else {
			S.selectorMove('up');
		}
	}
});

jwerty.key('left', function (e) {
	if (loadedStructure.settings) {

	} else if (loadedStructure.popup) {
		itemPrev(true, true);
	} else {
		// filter might be focused, dont do anything special
	}
});

jwerty.key('down', function (e) {
	if (loadedStructure.settings) {

	} else {
		e.preventDefault();
		if (loadedStructure.popup) {
			itemNext(true, false);
		} else {
			S.selectorMove('down');
		}
	}
});

jwerty.key('right', function (e) {
	if (loadedStructure.settings) {

	} else if (loadedStructure.popup) {
		e.preventDefault();
		itemNext(true, true);
	} else {
		// filter is focused, dont do anything special
	}
});

// @TODO should work this button in filter to go to the input beginning?
jwerty.key('home', function (e) {
	if (loadedStructure.settings) {

	} else {
		e.preventDefault();
		S.selectorMove('first');
		if (loadedStructure.popup) {
			itemPrev(true, true); // it will automatically find first file and opens it
		}
	}
});

jwerty.key('page-up', function (e) {
	if (loadedStructure.settings) {

	} else {
		e.preventDefault();
		if (loadedStructure.popup) {
			itemPrev10(true, true);
		} else {
			for (var i = 0; i < 10; i++) {
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
			itemNext10(true, false);
		} else {
			itemNext10(false, false);
		}
	}
});

// @TODO should work this button in filter to go to the input end?
jwerty.key('end', function (e) {
	if (loadedStructure.settings) {

	} else {
		e.preventDefault();
		S.selectorMove('last');
		if (loadedStructure.popup) {
			itemNext(true, true);
		}
	}
});

jwerty.key('enter', function (e) {
	if (loadedStructure.settings) {
		$("#form-settings").submit();
	} else if (loadedStructure.popup) {
		var item = S.getCurrentFile();
		if (item.isImage) {
			$('#popup-filename')[0].click();
		}
		// @TODO video open in fullscreen (also disable move left and right)
	} else {
		if ($("#filter .search").is(":focus")) {
			$('#filter .search').trigger('click');
		} else {
			S.selectorSelect();
		}
	}
});

jwerty.key('ctrl+enter', function (e) {
	if (loadedStructure.settings) {

	} else if (loadedStructure.popup) {

	} else {
		$('#filter .search').trigger('click');
	}
});

jwerty.key('space', function (e) {
	if (loadedStructure.settings) {

	} else if (loadedStructure.popup) {
		e.preventDefault(); // do not type in filter
		videoToggle();
	} else {
		// filter is focused, dont do anything special
	}
});

jwerty.key('ctrl+space', function (e) {
	if (loadedStructure.settings) {

	} else if (loadedStructure.popup) {
		presentationToggle();
	} else {
		// filter is focused, dont do anything special
	}
});

jwerty.key('backspace', function (e) {
	if (loadedStructure.settings) {

	} else if (loadedStructure.popup) {
		e.preventDefault(); // do not delete text from filter
		popupClose();
	} else {
		// filter is focused, dont do anything special
	}
});
jwerty.key('esc/ctrl+backspace/shift+backspace', function (e) {
	if (loadedStructure.settings) {

	} else if (loadedStructure.popup) {
		popupClose();
	} else { // go back
		var item = S.getFirst();
		if (item.displayText === '..') { // @HACK should be some property to recognize "go back"
			S.selectorMove(item.index);
			S.selectorSelect();
		}
	}
});
// Autofocus into input before start typing
$(window).on('keypress', function (event) {
	if (loadedStructure.settings) {

	} else if (loadedStructure.popup) {

	} else {
		$('#filter input').focus();
	}
});

// Move up and down in selector if is mouse wheel used
// @TODO screen is jumping up and down even with prevent default
// @TODO S.selectorSelect() if mouse wheel is clicked?
/*
 $(window).on('wheel', function(event){
 event.preventDefault();
 event.stopPropagation();
 console.log("wheeee: " + event.originalEvent.deltaY);
 console.log(event);
 S.selectorMove(event.originalEvent.deltaY < 0 ? 'up' : 'down');
 });
 */

var filterTimeout = null;
$('#filter input').on('keyup change', function (event) {
	// do not run filter if are used keys to move in structure
	if ([
		//undefined, // triggered on "change",
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
	$('#filter .filtered').html('<i class="fa fa-circle-o-notch fa-spin"></i>'); // @TODO in case of filtering, this "loading" might stuck
	// Run filter after a little bit of inactivity
	// @Author: https://schier.co/blog/2014/12/08/wait-for-user-to-stop-typing-using-javascript.html
	clearTimeout(filterTimeout);
	filterTimeout = setTimeout(function () {
		S.filter();
	}, 300); // @TODO this cooldown should be bigger when there is too many items to filter
});
