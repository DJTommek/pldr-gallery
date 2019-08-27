/**
 *
 * @param {int} len
 * @param {String} chr character to pad
 * @param {String} dir (left, both, right)
 * @returns {String}
 */
String.prototype.pad = String.prototype.pad || function (len, chr, dir)
{
    var str = this;
    len = (typeof len === 'number') ? len : 0;
    chr = (typeof chr === 'string') ? chr : ' ';
    dir = (/left|right|both/i).test(dir) ? dir : 'right';
    var repeat = function (c, l) { // inner "character" and "length"
        var repeat = '';
        while (repeat.length < l) {
            repeat += c;
        }
        return repeat.substr(0, l);
    }
    var diff = len - str.length;
    if (diff > 0) {
        switch (dir) {
            case 'left':
                str = '' + repeat(chr, diff) + str;
                break;
            case 'both':
                var half = repeat(chr, Math.ceil(diff / 2));
                str = (half + str + half).substr(1, len);
                break;
            default: // and "right"
                str = '' + str + repeat(chr, diff);
        }
    }
    return str;
};
/**
 * Escape regex chars to use it safely in regex as string 
 * 
 * @returns {String}
 */
String.prototype.escapeRegex = String.prototype.escapeRegex || function ()
{
    return this.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};
Array.prototype.last = function (last) {
    return this[this.length - (last || 1)];
}
function formatBytes(bytes, decimals) {
    if (bytes == 0)
        return '0 Bytes';
    var k = 1024,
            dm = decimals || 0,
            sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'],
            i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
