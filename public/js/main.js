var loadedStructure = {
    loadedFolder: '', // default is loaded nothing
    modal: false, // Is modal visible?
    filtering: false,
};
const S = new Structure();

function loadAndResize() {
    // resize image in modal to fit the screen
    $('.modal-body a.image').css('height', $('.modal-content').height() - 100); // keep some space for text (eg. file name)
    $('.modal-body a.image').css('width', $('.modal-content').width());

    $('.modal-body video').css('height', $('.modal-content').height() - 100); // keep some space for text (eg. file name)
    $('.modal-body video').css('width', $('.modal-content').width());
}

$(window).resize(function () {
    loadAndResize();
});
// loading is done when img is loaded (also as background to another element)
$('#content-modal .modal-dialog .modal-content img').load(function () {
    loadingImage(false);
});

window.onerror = function (msg, url, linenumber) {
    if (msg.match('ResizeObserver loop limit exceeded')) {
        // Dont care about this error: https://stackoverflow.com/questions/49384120/resizeobserver-loop-limit-exceeded
        return true;
    }
    alert('Error message: ' + msg + '\nURL: ' + url + '\nLine Number: ' + linenumber);
    return true;
}

// If hash is changed, something is being loaded (image of folder)
$(window).on('hashchange', function (e) {
    $('#filter input').focus();
    S.setCurrent(window.location.hash);
    loadStructure(false, function () { // load folder structure
        // If selected item is file, open modal with image
        var currentFile = S.getCurrentFile();
        if (currentFile) { // loaded item is file
            S.selectorMove(currentFile.index); // highlight loaded image
            var modal = '#content-modal .modal-dialog .modal-content ';
            $(modal + '.file-name').attr('href', S.getFileUrl(currentFile.index, true));
            $(modal + '.file-name span').text(currentFile.paths.last());
            if (currentFile.isVideo) {
                $(modal + 'video source').attr('src', S.getFileUrl(currentFile.index));
                $(modal + 'video').show().load();
                $(modal + 'a.image').hide();
            }
            if (currentFile.isImage) {
                $(modal + 'video').hide();
                $(modal + 'a.image').show().attr('href', S.getFileUrl(currentFile.index)).css('background-image', 'url(' + S.getFileUrl(currentFile.index) + ')');
                loadingImage(true); // starting loading img
                $(modal + 'img').attr('src', S.getFileUrl(currentFile.index));
            }
            var prevFile = S.getPrevious(currentFile.index);
            if (prevFile && prevFile.isFile) {
                $(modal + 'a.prev').show().attr('href', '#' + prevFile.path);
                $(modal + 'span.prev').hide();
            } else {
                $(modal + '.prev').hide();
                $(modal + 'span.prev').show();
            }
            var nextFile = S.getNext(currentFile.index);
            if (nextFile) {
                $(modal + 'span.next').hide();
                $(modal + 'a.next').show().attr('href', '#' + nextFile.path);
            } else {
                $(modal + 'a.next').hide();
                $(modal + 'span.next').show();
            }
            $('#content-modal').modal('show');
        } else { // If selected item is folder, load structure of that folder
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
    if (!window.location.hash && localStorage.getItem("hash-before-unload")) {
        window.location.hash = localStorage.getItem("hash-before-unload");
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
    var theme = localStorage.getItem("theme");
    if (theme && theme === 'dark') {
        $('#settings-toggle-theme span').text('Rozsvítit');
    }
    /**
     * Toggle dark theme
     */
    $('#settings-toggle-theme').on('click', function (event) {
        event.stopPropagation(); // disable closing dropdown menu
        event.preventDefault(); // disable a.href click
        var theme = localStorage.getItem("theme");
        if (!theme || theme === 'default') {
            theme = 'dark';
            $(this).children('span').text('Rozsvítit');
        } else {
            theme = 'default';
            $(this).children('span').text('Zhasnout');
        }
        localStorage.setItem("theme", theme);
        $('body').removeClass();
        $('body').addClass('theme-' + theme);
    });

    // some line is selected
    $('#structure').on('click', 'table tbody tr', function (e) {
        e.preventDefault();
        S.selectorMove($(this).data('index'));
        S.selectorSelect();
        return;
    });

    $('#content-modal').on('show.bs.modal', function (e) {
        loadedStructure.modal = true;
    }).on('shown.bs.modal', function () {
        loadAndResize();
    }).on('hide.bs.modal', function () {
        loadedStructure.modal = false;
        window.location.hash = S.getCurrentFolder();
        videoPause();
    });
});

function videoToggle() {
    try {
        if ($('#content-modal video')[0].paused) {
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
        $('#content-modal video')[0].pause();
    } catch (exception) {
        // In case of invalid src (for example)
    }
}
function videoPlay() {
    try {
        $('#content-modal video')[0].play();
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
function loadingImage(loading) {
    if (loading === true) {
        $('#content-modal .modal-dialog .modal-content .image-loading').show();
        loadedStructure.loading = true;
    }
    if (loading === false) {
        $('#content-modal .modal-dialog .modal-content .image-loading').hide();
    }
    return loadedStructure.loading;
}
