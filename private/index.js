var loadedStructure = {
    basePath: '/',
    previousBasePath: '/',
    basePaths: [],
    files: [],
    folders: [],
    fileIndexSelected: 0,
    previousSelectedIndexStructure: 0,
    selectedIndexStructure: 0,
    modal: false,               // Is modal visible?
};
var c = {
    keyboard: {
        filter: 'ctrl+f',
    }
};
window.onerror = function(msg, url, linenumber) {
    alert('Error message: '+msg+'\nURL: '+url+'\nLine Number: '+linenumber);
    return true;
}

$(function() {
//    loadAndResize();
    loadStructure();
    if (Cookies.get('googleLogin')) {
        $('#button-login').hide();
        $('#button-logout').show();
    } else {
        $('#button-login').show();
        $('#button-logout').hide();
    }
    $('#filter').focus();
    $('#structure').on('click', 'table tbody tr',  function(e) {
        e.preventDefault();
        $('#filter').focus();
        $('.structure-selected').removeClass('structure-selected');
        $(this).addClass('structure-selected');
        selectStructure($(this).find('td:nth-child(2)').find('a').attr('href'));
    });
    $('#imageModal').on('click', '.modal-dialog .modal-content .navigation button',  function(e) {
        e.preventDefault();
        var moveDirection = $(this).data('structure-move');
        switch($(this).data('structureMove')) {
            case 'up':
            case 'down':
                structureMove(moveDirection);
                break;
            case 'up-10':
                for (var i = 0; i < 10; i++) {
                    structureMove('up');
                }
                break;
            case 'down-10':
                for (var i = 0; i < 10; i++) {
                    structureMove('down');
                }
                break;
        }
        $('.structure-selected').trigger("click");
    });
    
    $('#filter').attr('placeholder', $('#filter').attr('placeholder') + ' (' + c.keyboard.filter + ')');
    $('#imageModal').on('show.bs.modal', function (e) {
        loadedStructure.modal = true;
    }).on('shown.bs.modal', function (e) {
    }).on('hide.bs.modal', function (e) {
        loadedStructure.modal = false;        
    });
    
    $('.image a img').load(function() {
       loading(false); 
    });
    
    jwerty.key(c.keyboard.filter, function(e) {
        e.preventDefault();
        if ($('#filter').is(':focus')) {
            $('#filter').blur();
        } else {
            $('#filter').focus();
        }
    });
    jwerty.key('up/left', function(e) {
        e.preventDefault();
        structureMove('up');
        if (loadedStructure.modal) {
            $('.structure-selected').trigger("click");
        }
    });
    jwerty.key('down/right', function(e) {
        e.preventDefault();
        structureMove('down');
        if (loadedStructure.modal) {
            $('.structure-selected').trigger("click");
        }
    });
    jwerty.key('home', function(e) {
        e.preventDefault();
        structureMove('first');
        if (loadedStructure.modal) {
            $('.structure-selected').trigger("click");
        }
    });
    jwerty.key('page-up', function(e) {
        e.preventDefault();
        for (var i = 0; i < 10; i++) {
            structureMove('up');            
        }
        if (loadedStructure.modal) {
            $('.structure-selected').trigger("click");
        }
    });
    jwerty.key('page-down', function(e) {
        e.preventDefault();
        for (var i = 0; i < 10; i++) {
            structureMove('down');            
        }
        if (loadedStructure.modal) {
            $('.structure-selected').trigger("click");
        }
    });
    jwerty.key('end', function(e) {
        e.preventDefault();
        structureMove('last');
        if (loadedStructure.modal) {
            $('.structure-selected').trigger("click");
        }
    });
    jwerty.key('enter', function(e) {
        $('.structure-selected').trigger("click");
    });
    jwerty.key('backspace', function(e) {
        $('#imageModal').modal('hide');
    });
    
    $('#filter').on('input', function(event) {
        filter();
    });
});

//function loadAndResize() {
//    $('#imageModal .modal-body .image img').css('max-height', $('.modal-dialog.modal-lg').height() - $('.modal-dialog.modal-lg .modal-head').height());
//}

function structureMove(direction) {
    console.log("structureMove('" + direction + "')");
    // Zjištění viditelných prvků
    var totalNodes = $('#structure tbody tr:visible').length;
    var selected = 0;
    // Zjištění vybraného prvku (index viditelných, ne všech)
    $('#structure table tbody tr:visible').each(function(index, element) {
        if ($(this).hasClass('structure-selected')) {
            selected = index;
            return; // Ukončení cyklu
        }
    });
    switch (direction) {
        default: // Posun na určitý prvek (číslo)
            if (Number.isInteger(direction) && direction > 0 && direction < totalNodes-1) {
                selected = direction;
            }
            break;
        case 'first': // Posun na první prvek
            selected = 0;
            break;
        case 'up': // Posun o prvek výše než je aktuálně vybraný
            if (selected > 0) {
                selected--;
            }
            break;
        case 'down': // Posun o prvek níže než je aktuálně vybraný
            if (selected < totalNodes-1) {
                selected++;
            }
            break;
        case 'last': // Posun na poslední prvek
            selected = totalNodes-1;
            break;
    }
    // Zrušení označení vybraného prvku
    // Výběr nového prvku podle indexu vůči viditelným prvkům
    $('#structure table tbody tr:visible').each(function(index, element) {
        if (index === selected) {
            if (loadedStructure.modal === true && $(this).data('type') !== 'file') {  // Pokud neco prohlizim a vybrany index neni soubor k prohlednuti
                selected++; // Zvysime index
                return true; // Continue
            }
            if (loadedStructure.modal === false || $(this).data('type') === 'file') { // Zmenime selected
                $('#structure table tbody tr.structure-selected').removeClass('structure-selected');
                $(this).addClass('structure-selected');
            }
            return false; // Ukončení cyklu
        }
    });
    
    try {
        // scrollIntoView není jquery funkce, takže pomocí [0] získáme první DOM element
        $('#structure table tbody tr.structure-selected')[0].scrollIntoView({ 
            block: 'center'
        });
        loadedStructure.selectedIndexStructure = selected;
    } catch (e) {}
}

function selectStructure(fileUrl) {
    fileUrl = fileUrl.replace(/^#/, '');
    var paths = fileUrl.split('/');
    loadedStructure.fileIndexSelected = loadedStructure.files.indexOf(fileUrl);
    if (fileUrl.match(/\/$/)) { // Načítáme složku
        window.location.hash = fileUrl;
        //loadStructure();
    } else { // Načítáme soubor
        var modal = '#imageModal .modal-dialog .modal-content ';
        $(modal + '.file-name').text(paths.last());
        $(modal + '.image a').attr('href', fileUrl);
        $(modal + '.image a img').attr('src', fileUrl);
        loading(true); // nacitame obrazek, event na dokonceni nacitani je jiz definovan
        //
        // Přednačtu obrázek, aby se při posunu hned zobrazil místo načítání
        var preload = '';
        
        var visible = $('#structure table tbody tr.structure-selected').prevAll('tr:visible[data-type="file"]').first();
        if (visible.length === 1) {
            $(modal + '.move-prev').attr('disabled', null);
            preload += '<img src="' + $(visible).find('td:nth-child(2)').find('a').attr("href").replace(/^#/, '') + '">';
        } else {
            $(modal + '.move-prev').attr('disabled', 'disabled');            
        }
        var visible = $('#structure table tbody tr.structure-selected').nextAll('tr:visible[data-type="file"]').first();
        if (visible.length === 1) {
            $(modal + '.move-next').attr('disabled', null);
            preload += '<img src="' + $(visible).find('td:nth-child(2)').find('a').attr("href").replace(/^#/, '') + '">';
        } else {
            $(modal + '.move-next').attr('disabled', 'disabled');            
        }
        
        $('#preload').html(preload);
        $(modal + '.navigation button.move-prev-10').attr('href', '#/' + loadedStructure.files[loadedStructure.fileIndexSelected-10]);
        $(modal + '.navigation button.move-prev').attr('href', '#/' + loadedStructure.files[loadedStructure.fileIndexSelected-1]);
        $(modal + '.navigation button.move-next').attr('href', '#/' + loadedStructure.files[loadedStructure.fileIndexSelected+1]);
        $(modal + '.navigation button.move-next-10').attr('href', '#/' + loadedStructure.files[loadedStructure.fileIndexSelected+10]);
        $('#imageModal').modal('show');
    }
}


function loadStructure(callback) {
    loadedStructure.previousBasePath = loadedStructure.basePath;
    loadedStructure.basePath = (window.location.hash.replace('#', '') || '/');
    $.ajax({
        url: '/',
        method: 'POST',
        data: {
            path: loadedStructure.basePath
        },
        success: function(result) {
            if (result.error === true || !result.result) {
                alert((result.result || 'Chyba během vytváření dat. Kontaktuj autora.'));
            } else {
                loadedStructure.basePaths = loadedStructure.basePath.split('/');
                
                // Cela cesta v hlaviccce
                var breadcrumb = '';
                breadcrumb += '<li><a href="#/">Galerie</a></li>';
                breadcrumbPath = '/';
                loadedStructure.basePaths.forEach(function(value, index) {
                    if (value) {
//                        if (index === loadedStructure.basePaths.length-2) {
//                            breadcrumb += '<li class="active">'+ value + '</li>';                                                    
//                        } else {
                            breadcrumb += '<li><a href="#' + (breadcrumbPath += value + '/')  + ' ">'+ decodeURI(value) + '</a></li>';
//                        }
                    }
                });
                $('#currentPath').html(breadcrumb);
                
                var content = '';
                content += '<table class="table-striped table-hover table-condensed"><thead>';
                content += '<tr>';
                content += '<th>&nbsp;</th>';
                content += '<th>Název</th>';
                content += '<th>Velikost</th>';
                content += '<th>Datum</th>';
                content += '</tr>';
                content += '</thead><tbody>';
                // O složku zpět
                if (loadedStructure.basePath !== '/') {
                    content += '<tr class="structure-back" data-type="folder"><td><span class="glyphicon glyphicon-level-up" aria-hidden="true"></span></td>';
                    content += '<td><a href="#' + loadedStructure.basePaths.slice(0, -2).join('/') + '/">..</a></td>';
                    content += '<td>&nbsp;</td>';
                    content += '<td>&nbsp;</td></tr>';
                }
                loadedStructure.files = [];
                loadedStructure.folders = [];
                result.result.forEach(function(pathData, index) {
                    pathData.paths = pathData.path.split('/');
                    if (pathData.size) {
                        loadedStructure.files.push(pathData.path);
                        content += '<tr data-type="file">';
                        content += '<td><span class="glyphicon glyphicon-picture" aria-hidden="true"></span></td>';
                        content += '<td><a href="#/' + pathData.path + '">' + pathData.paths.last() + '</a></td>';
                        content += '<td>' + formatBytes(pathData.size, 2) + '</td>';
                        content += '<td>' + pathData.created.slice(0, -4); + '</td>';
                    } else {
                        loadedStructure.folders.push(pathData.path);
                        content += '<tr data-type="folder">';
                        content += '<td><span class="glyphicon glyphicon-folder-open" aria-hidden="true"></span></td>';
                        content += '<td><a href="#/' + pathData.path + '/">' + pathData.paths.last() + '</a></td>';
                        content += '<td>&nbsp;</td>';
                        content += '<td>&nbsp;</td>';
                    }
                    content += '</tr>';
                });
                content += '</tbody></table>';
                $('#structure').html(content);

                // Uložení vyberu v strukture pokud jdu zpet, jinak prvni struktura
                if (loadedStructure.previousBasePath.length > loadedStructure.basePath.length) {
                    structureMove(loadedStructure.previousSelectedIndexStructure);
                } else {
                    structureMove('first');                    
                }
                loadedStructure.previousSelectedIndexStructure = loadedStructure.selectedIndexStructure;
                
//                loadedStructure.previousBasePath = loadedStructure.basePath;
//                loadedStructure.basePath = (window.location.hash.replace('#', '') || '/');
//                loadedStructure.previousSelectedIndexStructure = loadedStructure.selectedIndexStructure;

                    
                filter();
            }
        },
        error: function() {
            alert((result.result || 'Chyba během načítání dat. Kontaktuj autora.'));
        },
		beforeSend: function() {
            loading(true);
		},
		complete: function() {
            loading(false);
		},
    });
}

function loading(loading) {
    if (loading) {
        $('#loading').show();
        console.log("loading...");
    } else {
        console.log("loading done!");
        $('#loading').hide();
    }
}

Array.prototype.last = function(last) {
    return this[this.length-(last || 1)];
}
function formatBytes(bytes, decimals) {
   if(bytes == 0) return '0 Bytes';
   var k = 1024,
       dm = decimals || 0,
       sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'],
       i = Math.floor(Math.log(bytes) / Math.log(k));
   return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
/*
 * Filtrování textu ve struktuře
 * @author: http://vivekarora.com/blog/simple-search-filter-using-jquery/
 */
function filter(){
    console.log("filter");
    var val = $('#filter').val().toLowerCase();
    $("#structure tbody tr").addClass('hide');
    $("#structure tbody tr").each(function(){
        var text = $(this).text().toLowerCase();
        if (text.indexOf(val) != -1) {
            $(this).removeClass('hide');
        }
    });
    $("#structure tbody tr.structure-back").removeClass('hide');
    structureMove();
}
