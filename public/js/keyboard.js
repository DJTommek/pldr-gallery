jwerty.key(c.keyboard.filter, function (e) {
    e.preventDefault();
    if ($('#filter').is(':focus')) {
        $('#filter').blur();
    } else {
        $('#filter').focus();
    }
});
jwerty.key('up/left', function (e) {
    e.preventDefault();
    S.selectorMove('up');
    if (loadedStructure.modal) {
        // if new selected item is not file, select first file and show it
        if (!S.get(S.selectedIndex).isFile) {
            S.selectorMove(S.getFirstFile().index);
        }
        $('.structure-selected:visible').trigger("click");            
    }
});
jwerty.key('down/right', function (e) {
    e.preventDefault();
    S.selectorMove('down');
    if (loadedStructure.modal) {
        $('.structure-selected:visible').trigger("click");
    }
});
jwerty.key('home', function (e) {
    e.preventDefault();
    S.selectorMove('first');
    if (loadedStructure.modal) {
        // if new selected item is not file, select first file and show it
        if (!S.get(S.selectedIndex).isFile) {
            S.selectorMove(S.getFirstFile().index);
        }
        $('.structure-selected:visible').trigger("click");            
    }
});
jwerty.key('page-up', function (e) {
    e.preventDefault();
    for (var i = 0; i < 10; i++) {
        S.selectorMove('up');
    }
    if (loadedStructure.modal) {
        // if new selected item is not file, select first file and show it
        if (!S.get(S.selectedIndex).isFile) {
            S.selectorMove(S.getFirstFile().index);
        }
        $('.structure-selected:visible').trigger("click");            
    }
});
jwerty.key('page-down', function (e) {
    e.preventDefault();
    for (var i = 0; i < 10; i++) {
        S.selectorMove('down');
    }
    if (loadedStructure.modal) {
        $('.structure-selected:visible').trigger("click");
    }
});
jwerty.key('end', function (e) {
    e.preventDefault();
    S.selectorMove('last');
    if (loadedStructure.modal) {
        $('.structure-selected:visible').trigger("click");
    }
});
jwerty.key('enter', function (e) {
    $('.structure-selected:visible').trigger("click");
});
jwerty.key('backspace', function (e) {
    // @TODO 
    // - if in modal, close it
    // - if not in modal but filter is active, delete character in filter
    // - if not in modal and filter is not active, move in folder up (if not in root)
    $('#imageModal').modal('hide');
});
jwerty.key('shift-backspace', function (e) {
    $('#imageModal').modal('hide');
    // @TODO 
    // - if in modal, close it
    // - if not in modal, move in folder up (if not in root)
});

var filterTimeout = null;
$('#filter').on('keyup keypress blur change', function (event) {
    // @TODO - do not run filter if are used keys to move in structure (up, down, right, left, enter...)
    // Run filter after a little bit of inactivity
    // @Author: https://schier.co/blog/2014/12/08/wait-for-user-to-stop-typing-using-javascript.html
    clearTimeout(filterTimeout);
    filterTimeout = setTimeout(function () {
        S.filter();
    }, 500);
});
