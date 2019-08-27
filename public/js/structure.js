class Structure {
    constructor() {
        // currently loaded folder
        this.currentFolder = '/';
        this.currentFolders = [];
        
        this.items = [];
        this.files = [];
        this.folders = [];

        this.selectedIndex = 0; //0 is root
        this.isRoot = true;
    }
    selectorMove(direction) {
        switch (direction) {
            default: // Posun na určitý prvek (číslo)
                if (Number.isInteger(direction) && direction >= 0 && direction < this.items.length) {
                    this.selectedIndex = direction;
                }
                break;
            case 'first': // Posun na první prvek
                this.selectedIndex = 0;
                break;
            case 'up': // Posun o prvek výše než je aktuálně vybraný
                if (this.selectedIndex > 0) {
                    this.selectedIndex--;
                }
                break;
            case 'down': // Posun o prvek níže než je aktuálně vybraný
                if (this.selectedIndex < this.items.length - 1) {
                    this.selectedIndex++;
                }
                break;
            case 'last': // Posun na poslední prvek
                this.selectedIndex = this.items.length - 1;
                break;
        }
        $('#structure table tbody tr.structure-selected').removeClass('structure-selected');
        // css is indexing from one
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
    getFile(index) {
        var item = this.items[index];
        return (item && item.isFile) ? item : null;
    }
    getFileUrl(index) {
        var item = this.getFile(index);
        if (item) {
            return '__API/IMAGE/?IMAGE=' + btoa(encodeURIComponent(item.path));
        }
        return '';
    }
    getFirstFile() {
        return this.files[0] || null;
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
        console.log();
    }
    getCurrentFolder(array) {
        if (array === true) {
            return this.currentFolders;
        }
        return this.currentFolder;
    }
    getCurrentFile() {
        var a = this.getByName(this.currentPath);
        return (a && a.isFile) ? a : null;
    }
}
