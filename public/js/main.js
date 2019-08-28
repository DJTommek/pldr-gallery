var loadedStructure = {
    loadedFolder: '', // default is loaded nothing
    modal: false, // Is modal visible?
};
const S = new Structure();

function loadAndResize() {
    // resize image in modal to fit the screen
    $('.modal-body a.image').css('height', $('.modal-content').height() - 100); // keep some space for text (eg. file name)
    $('.modal-body a.image').css('widht', $('.modal-content').width());
}

$(window).resize(function () {
    loadAndResize();
});

window.onerror = function (msg, url, linenumber) {
    alert('Error message: ' + msg + '\nURL: ' + url + '\nLine Number: ' + linenumber);
    return true;
}

// If hash is changed, something is being loaded (image of folder)
$(window).on('hashchange', function (e) {
    $('#filter').focus();
    S.setCurrent(window.location.hash);
    loadStructure(function () { // load folder structure
        // If selected item is file, open modal with image
        var currentFile = S.getCurrentFile();
        if (currentFile) { // loaded item is file
            S.selectorMove(currentFile.index); // highlight loaded image
            var modal = '#imageModal .modal-dialog .modal-content ';
            $(modal + '.file-name').text(currentFile.paths.last());
            $(modal + 'a.image').attr('href', S.getFileUrl(currentFile.index)).css('background-image', 'url(' + S.getFileUrl(currentFile.index) + ')');
            // @TODO added loading animation while loading image 
            // - set this url also to invisible img tag and it will run onLoad event when its loaded also as background-image
            //loading(true); // nacitame obrazek, event na dokonceni nacitani je jiz definovan
            var prevFile = S.getPrevious(currentFile.index);
            if (prevFile && prevFile.isFile) {
                $(modal + '.prev').show().attr('href', '#' + prevFile.path);
            } else {
                $(modal + '.prev').hide();
            }
            var nextFile = S.getNext(currentFile.index);
            if (nextFile) {
                $(modal + '.next').show().attr('href', '#' + nextFile.path);
            } else {
                $(modal + '.next').hide();
            }
            // @TODO if clicking on the buttons until end, button dissapears and after next click it trigger file opening in new tab.
            // it will be better just remove right/left icon and click will do nothing
            $('#imageModal').modal('show');
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
    S.setCurrent(window.location.hash);
    window.dispatchEvent(new HashChangeEvent("hashchange"));

    if (Cookies.get('googleLogin')) {
        $('#button-login').hide();
        $('#button-logout').show();
    } else {
        $('#button-login').show();
        $('#button-logout').hide();
    }

    // settings
    if (Cookies.get('settings-compress') === 'true') {
        $('#settings-compress').attr('checked', true);
    }
    $('#settings-compress').on('click', function (e) {
        Cookies.set('settings-compress', $(this).is(':checked'));
    });

    /**
     * Toggle dark theme
     */
    $('#settings-theme').change(function () {
        if (this.checked) {
            localStorage.setItem("theme", $(this).val());
            $('body').addClass('theme-dark');
        } else {
            localStorage.removeItem("theme");
            $('body').removeClass();
        }
    });

    // some line is selected
    $('#structure').on('click', 'table tbody tr', function (e) {
        e.preventDefault();
        S.selectorMove($(this).data('index'));
        S.selectorSelect();
        return;
    });

    $('#imageModal').on('show.bs.modal', function (e) {
        loadedStructure.modal = true;
    }).on('shown.bs.modal', function () {
        loadAndResize();
    }).on('hide.bs.modal', function () {
        loadedStructure.modal = false;
        window.location.hash = S.getCurrentFolder();
    });
});

function loadStructure(callback) {
    // in case of triggering loading the same structure again (already loaded), skip it
    if (loadedStructure.loadedFolder === S.getCurrentFolder()) {
        console.log("Structure is already loaded, skip");
        return (typeof callback === 'function' && callback());
    }
    $.ajax({
        url: '/',
        method: 'POST',
        data: {
            path: S.getCurrentFolder()
        },
        success: function (result) {
            if (result.error === true || !result.result) {
                alert((result.result || 'Chyba během vytváření dat. Kontaktuj autora.'));
            } else {
                loadedStructure.loadedFolder = S.getCurrentFolder();
                S.setAll(result.result);

                // Cela cesta v hlaviccce
                var breadcrumbHtml = '';
                breadcrumbHtml += '<li class="breadcrumb-item"><a href="#/">Galerie</a></li>';
                var breadcrumbPath = '/';
                S.getCurrentFolder(true).forEach(function (folderName) {
                    if (folderName) {
                        breadcrumbHtml += '<li class="breadcrumb-item"><a href="#' + (breadcrumbPath += folderName + '/') + ' ">' + decodeURI(folderName) + '</a></li>';
                    }
                });
                $('#currentPath').html(breadcrumbHtml);

                var content = '';
                content += '<table class="table-striped table-hover table-condensed"><thead>';
                content += ' <tr>';
                content += '  <th>&nbsp;</th>';
                content += '  <th>Název</th>';
                content += '  <th>Velikost</th>';
                content += '  <th>Datum</th>';
                content += ' </tr>';
                content += '</thead><tbody>';
                S.getFolders().forEach(function (item) {
                    content += '<tr data-type="folder" data-index="' + item.index + '">';
                    content += ' <td><i class="fa fa-' + (item.displayIcon || 'folder-open') + ' fa-fw"></i></td>';
                    content += ' <td><a href="#' + item.path + '">' + (item.displayText || item.paths.last()) + '</a></td>';
                    content += ' <td>&nbsp;</td>';
                    content += ' <td>&nbsp;</td>';
                    content += '</tr>';
                });
                S.getFiles().forEach(function (item) {
                    content += '<tr data-type="file" data-index="' + item.index + '">';
                    content += '<td><i class="fa fa-file-image-o fa-fw"></i></td>';
                    content += '<td><a href="#' + item.path + '">' + item.paths.last() + '</a></td>';
                    content += '<td>' + formatBytes(item.size, 2) + '</td>';
                    content += '<td>' + item.created.slice(0, -4) + '</td>';
                    content += '</tr>';
                });

                if (result.result.length === 1) { // only go back
                    //@TODO - if root folder has only one item it shows this message too
                    content += '<tr class="structure-back" data-type="folder">';
                    content += '<td><i class="fa fa-info fa-fw"></i></td>';
                    content += '<td colspan="3">Složka je prázdná.</td>';
                    content += '</tr>';
                }
                content += '<tr class="no-filtered-items d-none" data-type="info">';
                content += '<td><i class="fa fa-warning fa-fw"></i></td>';
                content += '<td colspan="3">Filter nevyhovuje žádnému řádku.</td>';
                content += '</tr>';

                content += '</tbody></table>';
                $('#structure').html(content);

                $('#filter').val(''); // @TODO - remove "typing waiting" cooldown
//                S.filter();
            }
        },
        error: function () {
            alert('Chyba během načítání dat. Kontaktuj autora.');
        },
        beforeSend: function () {
            loading(true);
        },
        complete: function () {
            loading(false);
            (typeof callback === 'function' && callback());
        }
    });
}

function loading(loading) {
    if (loading) {
        $('#loading').show();
    } else {
        setTimeout(function () {
            $('#loading').hide();
        }, 100);
    }
}
