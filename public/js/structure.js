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
        if (item) {
            window.location.hash = item.path;
        }
    }

    setAll(items) {
        // clear all previous data
        this.items = [];
        this.files = [];
        this.folders = [];
        var index = 0;
        items.folders.forEach(function (item) {
            item.index = index;
            item.paths = item.path.split('/').filter(n => n); // split path to folders and remove empty elements (if path start or end with /)
            item.isFolder = true;
            item.isFile = false;
            item.ext = '';
            item.isImage = false;
            item.isVideo = false;
            item.hide = false;
            this.folders.push(item);
            index++;
        }, this);
        items.files.forEach(function (item) {
            item.index = index;
            item.paths = item.path.split('/').filter(n => n); // split path to folders and remove empty elements (if path start or end with /)
            item.isFolder = false;
            item.isFile = true;
            item.ext = item.paths.last().split('.').last();
            item.isImage = (['jpg', 'jpeg', 'png', 'bmp'].indexOf(item.paths.last().split('.').pop().toLowerCase()) >= 0);
            item.isVideo = (['mp4', 'avi'].indexOf(item.paths.last().split('.').pop().toLowerCase()) >= 0);
            item.hide = false;
            this.files.push(item);
            index++;
        }, this);
        this.items = items.folders.concat(items.files);
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
        var item = this.getNext(-1);
        if (item) {
            if (item.isFolder) {
                return this.getNextFile(item.index);
            } else {
                return item;
            }
        }
        return null;
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
    // return next visible item
    getNextFile(index) {
        index++;
        if (index > this.items.length) {
            return null;
        }
        var item = this.get(index);
        if (item && item.hide === false && item.isFile) {
            return item;
        }
        return this.getNextFile(index);
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
    getFileUrl(index, download) {
        var item = this.getFile(index);
        if (download === true) {
            return '/api/download?path=' + btoa(encodeURIComponent(item.path));
        }
        if (item && item.isVideo) {
            return '/api/video?path=' + btoa(encodeURIComponent(item.path));
        }
        if (item && item.isImage) {
            return '/api/image?path=' + btoa(encodeURIComponent(item.path));
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
    // return true if matches
    // @TODO - move it into the functions?
    runFilter(filterText, value) {
        if (filterText.match(/^\/.+\/$/)) { // check, if string has delimiters is regex, at least /./
            filterText = filterText.slice(1, -1); // remove delimiters, new RegExp will add automatically
            var filterRegex = new RegExp(filterText);
            return filterRegex.test(value);
        } else {
            filterText = filterText.toLowerCase().trim();
            return (value.toLowerCase().trim().indexOf(filterText) !== -1);
        }
    }
    /**
     * Hide items which dont match to the filter text
     */
    filter() {
        var self = this;
        //Important note: Filter can change only if modal is closed.
        if (loadedStructure.modal) {
            console.warn('Filtering is not possible, modal window is active');
            return;
        }
        if (loadedStructure.filtering) {
            console.warn('Filtering is already running, cancel new request');
            return;
        }
        var filterText = $('#filter input').val().toLowerCase();
        if (filterText.match(/^\/.+\/$/)) { // check, if string has delimiters is regex, at least /./
            // @TODO in case of regexp error, filter might be triggered twice so this alert message too
            try { // try if regex is valid before running filter
                new RegExp(filterText.slice(1, -1));
            } catch (exception) {
                console.warn('User input filter is not valid: ' + exception.message);
                alert('Filter is not valid: ' + exception.message);
                $('#filter .filtered').text(0);
                return;
            }
        }
        loadedStructure.filtering = true;
        var allHidden = true;
        var visible = 0;
        this.getItems().forEach(function (item) {
            // Do not touch on "go back" item! Should be visible all times
            if (item.displayText === '..') {
                return;
            }
            if (self.runFilter(filterText, item.paths.last())) {
                $("#structure tbody").find('[data-index="' + item.index + '"]').show();
                allHidden = false;
                item.hide = false;
                visible++;
            } else {
                item.hide = true;
                $("#structure tbody").find('[data-index="' + item.index + '"]').hide();
            }
        });
        if (allHidden) { // if no item passed filter, show warning
            $('#filter input').addClass('is-invalid');
        } else {
            $('#filter input').removeClass('is-invalid');
        }
        $('#filter .filtered').text(visible);
        var item = this.get(this.selectedIndex);
        if (!item) { // new opened folder is empty, do not move with selector
            loadedStructure.filtering = false;
            return;
        }
        if (item.hide) { // if currently selected item is not visible, move to previous visible
            this.selectorMove('up');
            if (this.get(this.selectedIndex).hide) { // if there is no previous visible item, move to the next visible item
                this.selectorMove('down');
            }
            // if no item is visible, dont do anything...
        }
        if (this.get(this.selectedIndex).displayText === '..') { // if is filter active and selected item is "go back", try select next visible item
            this.selectorMove('down');
        }
        loadedStructure.filtering = false;
    }
}
