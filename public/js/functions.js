String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.split(search).join(replacement);
};
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

Date.prototype.human = function (returnObject) {
    var res = {
        milisecond: (this.getMilliseconds() + '').pad(3, '0', 'left') + '',
        second: (this.getSeconds() + '').pad(2, '0', 'left') + '',
        minute: (this.getMinutes() + '').pad(2, '0', 'left') + '',
        hour: (this.getHours() + '').pad(2, '0', 'left') + '',
        day: (this.getDate() + '').pad(2, '0', 'left') + '',
        month: (this.getMonth() + 1 + '').pad(2, '0', 'left') + '',
        year: (this.getFullYear() + '').pad(2, '0', 'left') + ''
    }
    res.date = res.year + '.' + res.month + '.' + res.day;
    res.time = res.hour + ':' + res.minute + ':' + res.second;
    res.toString = function () {
        return (res.date + ' ' + res.time + '.' + res.milisecond);
    }
    if (returnObject === true) {
        return res;
    } else {
        return res + '';
    }
}
global.isNumeric = function (n) {
    return !isNaN(parseFloat(n)) && isFinite(n);
}

/**
 * Format miliseconds to human redable string, 10d 2h 52m 684ms
 *
 * @param {int} miliseconds
 * @returns {String}
 */
global.msToHuman = function (miliseconds) {
    var milliseconds = Math.floor((miliseconds) % 1000);
    var seconds = Math.floor((miliseconds / (1000)) % 60);
    var minutes = Math.floor((miliseconds / (1000 * 60)) % 60);
    var hours = Math.floor((miliseconds / (1000 * 60 * 60)) % 24);
    var days = Math.floor((miliseconds / (1000 * 60 * 60 * 24)));

    var result = '';
    result += (days > 0 ? ' ' + days + 'd' : '');
    result += (hours > 0 ? ' ' + hours + 'h' : '');
    result += (minutes > 0 ? ' ' + minutes + 'm' : '');
    result += (seconds > 0 ? ' ' + seconds + 's' : '');
    result += (milliseconds > 0 ? ' ' + milliseconds + 'ms' : '');
    return result.trim();
}
/**
 * Format miliseconds to human redable string, 10d 2h 52m 684ms
 *
 * @param {int} miliseconds
 * @returns {String}
 */
global.humanToMs = function (humanString) {
    result = 0;
    var reList = [
        [/([0-9]+)d/, 1000 * 60 * 60 * 24],
        [/([0-9]+)h/, 1000 * 60 * 60],
        [/([0-9]+)m/, 1000 * 60],
        [/([0-9]+)s/, 1000],
        [/([0-9]+)ms/, 1]
    ];
    reList.forEach(function (timeData) {
        var timeValue = timeData[0].exec(humanString);
        if (timeValue) {
            result += timeValue[1] * timeData[1];
        }
    });
    return result;
}