jwerty.key('up', function (e) {
    e.preventDefault();
    S.selectorMove('up');
    if (loadedStructure.modal) {
        // if new selected item is not file, select first file and show it
        if (!S.get(S.selectedIndex).isFile) {
            S.selectorMove(S.getFirstFile().index);
        }
        S.selectorSelect();
    }
});
jwerty.key('left', function (e) {
    if (loadedStructure.modal) {
        e.preventDefault();
        S.selectorMove('up');
        // if new selected item is not file, select first file and show it
        if (!S.get(S.selectedIndex).isFile) {
            S.selectorMove(S.getFirstFile().index);
        }
        S.selectorSelect();
    } else {
        // filter is focused, dont do anything special
    }
});
jwerty.key('down', function (e) {
    e.preventDefault();
    S.selectorMove('down');
    if (loadedStructure.modal) {
        S.selectorSelect();
    }
});
jwerty.key('right', function (e) {
    if (loadedStructure.modal) {
        e.preventDefault();
        S.selectorMove('down');
        S.selectorSelect();
    } else {
        // filter is focused, dont do anything special
    }
});
// @TODO should work this button in filter to go to the input beginning?
jwerty.key('home', function (e) {
    e.preventDefault();
    S.selectorMove('first');
    if (loadedStructure.modal) {
        // if new selected item is not file, select first file and show it
        if (S.get(S.selectedIndex).isFile === false) {
            S.selectorMove(S.getFirstFile().index);
        }
        S.selectorSelect();
    }
});
jwerty.key('page-up', function (e) {
    e.preventDefault();
    for (var i = 0; i < 10; i++) {
        S.selectorMove('up');
    }
    if (loadedStructure.modal) {
        // if new selected item is not file, select first file and show it
        // If modal is opened, at least one file is always available
        if (S.get(S.selectedIndex).isFile === false) {
            S.selectorMove(S.getFirstFile().index);
        }
        S.selectorSelect();
    }
});
jwerty.key('page-down', function (e) {
    e.preventDefault();
    for (var i = 0; i < 10; i++) {
        S.selectorMove('down');
    }
    if (loadedStructure.modal) {
        S.selectorSelect();
    }
});
// @TODO should work this button in filter to go to the input end?
jwerty.key('end', function (e) {
    e.preventDefault();
    S.selectorMove('last');
    if (loadedStructure.modal) {
        S.selectorSelect();
    }
});
jwerty.key('enter', function (e) {
    if (loadedStructure.modal) {
        var item = S.getCurrentFile();
        if (item.isImage) {
            $('#content-modal .modal-dialog .modal-content a.image')[0].click();
        }
        // @TODO video open in fullscreen (also disable move left and right)
    } else {
        S.selectorSelect();
    }
});

jwerty.key('ctrl+enter', function (e) {
    if (loadedStructure.modal) {
        
    } else {
        $('#filter .search').trigger('click');
    }
});

jwerty.key('space', function (e) {
    if (loadedStructure.modal) {
        e.preventDefault(); // do not delete text from filter
        videoToggle();
    } else {
        // filter is focused, dont do anything special
    }
});

jwerty.key('backspace', function (e) {
    if (loadedStructure.modal) {
        e.preventDefault(); // do not delete text from filter
        $('#content-modal').modal('hide');
    } else {
        // filter is focused, dont do anything special
    }
});
jwerty.key('esc/ctrl+backspace/shift+backspace', function (e) {
    if (loadedStructure.modal) {
        $('#content-modal').modal('hide');
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
    if (loadedStructure.modal === false) {
        $('#filter input').focus();
    }
});
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
