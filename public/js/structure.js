class Structure {
    constructor() {
        // currently loaded folder
        this.currentFolder = '/';
        this.currentFolders = [];

        this.items = [];
        this.files = [];
        this.folders = [];

        this.selectedIndex = 0;
    }
    selectorMove(direction) {
        var item = null;
        switch (direction) {
            default: // Posun na určitý prvek (číslo)
                if (Number.isInteger(direction) && direction >= 0 && direction < this.items.length) {
                    this.selectedIndex = direction;
                }
                break;
            case 'first': // Posun na první prvek
                item = this.getFirst();
                break;
            case 'up': // Posun o prvek výše než je aktuálně vybraný
                item = this.getPrevious(this.selectedIndex);
                break;
            case 'down': // Posun o prvek níže než je aktuálně vybraný
                item = this.getNext(this.selectedIndex);
                break;
            case 'last': // Posun na poslední prvek
                item = this.getLast();
                break;
        }
        if (item) {
            this.selectedIndex = item.index;
        }
        console.log("selectorMove(" + direction + "), selected index: " + this.selectedIndex);
        // css is indexing from one
        $('#structure table tbody tr.structure-selected').removeClass('structure-selected');
        $('#structure table tbody tr:nth-child(' + (this.selectedIndex + 1) + ')').addClass('structure-selected');
        try {
            // center view to the selected item
            // scrollIntoView není jquery funkce, takže pomocí [0] získáme první DOM element
            $('#structure table tbody tr.structure-selected')[0].scrollIntoView({
                block: 'center'
            });
        } catch (e) {
            // @HACK Be quiet! (probably just not supported)
        }
    }

    selectorSelect() {
        var item = this.get(this.selectedIndex);
        window.location.hash = item.path;
    }

    setAll(items) {
        // clear all previous data
        this.items = [];
        this.files = [];
        this.folders = [];

        items.forEach(function (item, index) {
            item.index = index;
            item.paths = item.path.split('/').filter(n => n); // split path to folders and remove empty elements (if path start or end with /)
            item.isFolder = (typeof item.size === 'undefined');
            item.isFile = !item.isFolder;
            item.hide = false;
            if (item.isFolder) {
                this.folders.push(item);
            }
            if (item.isFile) {
                this.files.push(item);
            }
        }, this);
        this.items = items;
    }
    getFolders() {
        return this.folders;
    }
    getFiles() {
        return this.files;
    }
    getItems() {
        return this.items;
    }
    get(index) {
        return this.items[index] || null;
    }

    // get first visible item
    getFirst() {
        // initial index has to be -1 because next will be 0
        return this.getNext(-1);
    }
    // get first visible file
    getFirstFile() {
        return this.files[0] || null;
    }
    // get last visible item
    getLast() {
        // initial index has to be greater than index of last item
        return this.getPrevious(this.items.length);
    }
    // return next visible item
    getNext(index) {
        index++;
        if (index > this.items.length) {
            return null;
        }
        var item = this.get(index);
        if (item && item.hide === false) {
            return item;
        }
        return this.getNext(index);
    }
    // return previous visible item
    getPrevious(index) {
        index--;
        if (index < 0) {
            return null;
        }
        var item = this.get(index);
        if (item && item.hide === false) {
            return item;
        }
        return this.getPrevious(index);
    }

    getFile(index) {
        var item = this.get(index)
        return (item && item.isFile) ? item : null;
    }
    getFileUrl(index) {
        var item = this.getFile(index);
        if (item) {
            return '__API/IMAGE/?IMAGE=' + btoa(encodeURIComponent(item.path));
        }
        return '';
    }

    getByName(name) {
        var result = null;
        this.items.forEach(function (item) {
            if (item.path === name) {
                result = item;
            }
        }, this);
        return result;

    }

    /*
     * Manage currently loaded path
     */
    setCurrent(path) {
        path = decodeURI(path).replace(/^#/, '');
        var paths = path.split('/');
        console.log("setcurrentPath: " + path);
        this.currentPath = path;
        this.currentFolders = paths.slice(1, paths.length - 1); // slice first and last elements from array
        this.currentFolder = ('/' + this.currentFolders.join('/') + '/').replace('\/\/', '/');
    }
    getCurrentFolder(array) {
        if (array === true) {
            return this.currentFolders;
        }
        return this.currentFolder;
    }
    getCurrentFile() {
        var item = this.getByName(this.currentPath);
        return (item && item.isFile) ? item : null;
    }
    /**
     * Hide items which dont match to the filter text
     */
    filter() {
        //Important note: Filter can change only if modal is closed.
        if (loadedStructure.modal) {
            return;
        }
        var filter = $('#filter').val().toLowerCase();
        var allHidden = true;
        this.getItems().forEach(function (item) {
            // Do not touch on "go back" item! Should be visible all times
            if (item.displayText === '..') {
                return;
            }
            var text = item.paths.last().toLowerCase().trim();
            if (text.indexOf(filter) === -1) {
                item.hide = true;
                $("#structure tbody").find('[data-index="' + item.index + '"]').hide();
            } else {
                $("#structure tbody").find('[data-index="' + item.index + '"]').show();
                allHidden = false;
                item.hide = false;
            }
        });
        if (allHidden) {
            // @TODO dont show this message if there are no files in folder. Need to do this dynamicaly (in root 0 items, everywhere else at least one item for go back)
            $("#structure tbody tr.no-filtered-items").removeClass('d-none');
        } else {
            $("#structure tbody tr.no-filtered-items").addClass('d-none');
        }
        // if currently selected item is not visible, move to previous visible
        if (this.get(this.selectedIndex).hide) {
            this.selectorMove('up');
            // if there is no previous visible item, move to the next visible item
            if (this.get(this.selectedIndex).hide) {
                this.selectorMove('down');
            }
            // if no item is visible, dont do anything...
        }
    }
}
