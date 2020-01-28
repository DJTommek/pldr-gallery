String.prototype.replaceAll = function (search, replacement) {
	return this.split(search).join(replacement);
};
/**
 * Pad string
 *
 * @param {int} len
 * @param {String} [chr] character to pad
 * @param {String} [dir] (left, both, right = default)
 * @returns {String}
 */
String.prototype.pad = String.prototype.pad || function (length, string, type)
{
	let str = this;

	// validation of length
	if (typeof length !== 'number' || length < 1) {
		throw new Error('Parameter "length" has to be positive number.')
	}

	// validation of string
	if (string === undefined) {
		string = ' ' // default character is space
	} else if (typeof string !== 'string' || string.length < 1) {
		throw new Error('Parameter "string" has to be string of non-zero length')
	}

	// validation of type (direction)
	const allowedTypes = ['left', 'right', 'both'];
	if (type === undefined) {
		type = 'right' // default type is 'right'
	} else if (allowedTypes.inArray(type) === false) {
		throw new Error('Parameter "type" has to be "' + allowedTypes.join('" or "') + '".')
	}

	const repeat = function (c, l) { // inner "character" and "length"
		let repeat = '';
		while (repeat.length < l) {
			repeat += c;
		}
		return repeat.substr(0, l);
	};

	const diff = length - str.length;
	if (diff > 0) {
		switch (type) {
			case 'left':
				str = '' + repeat(string, diff) + str;
				break;
			case 'both':
				const half = repeat(string, Math.ceil(diff / 2));
				str = (half + str + half).substr(0, length);
				break;
			case 'right': // and "right"
				str = '' + str + repeat(string, diff);
		}
	}
	return str;
};

/**
 * Format string based on parameters
 *
 * @example "a{0}bcd{1}ef".formatUnicorn("FOO", "BAR"); // "aFOObcdBARef"
 * @example "a{first}bcd{second}ef{first}".formatUnicorn({first: "FOO", second: "BAR"}); // "aFOObcdBARefFOO"
 * @author https://stackoverflow.com/a/18234317/3334403
 * @returns {string}
 */
String.prototype.formatUnicorn = function () {
    "use strict";
    let str = this.toString();
    if (arguments.length) {
        const t = typeof arguments[0];
        const args = ("string" === t || "number" === t) ? Array.prototype.slice.call(arguments) : arguments[0];
        for (let key in args) {
			str = str.replace(new RegExp("\\{" + key + "\\}", "gi"), args[key]);
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

/**
 * Escape HTML tags
 *
 * @author https://stackoverflow.com/a/6234804/3334403
 */
String.prototype.escapeHtml = String.prototype.escapeHtml || function ()
{
	return this
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
};

/**
 * Return last element of array
 * @TODO might be better returning -1?
 * @TODO Check if array is not empty, then return null or error?
 */
Array.prototype.last = function (last) {
	return this[this.length - (last || 1)];
};

/**
 * Return if value is in array
 */
Array.prototype.inArray = function (element) {
	return (this.indexOf(element) >= 0)
};

/**
 * Remove item from array by value
 *
 * @param item
 * @returns {Array}
 */
Array.prototype.removeByValue = function (item) {
	let index = this.indexOf(item);
	if (index !== -1) {
		this.splice(index, 1);
	}
	return this;
};

/**
 * Push into array only if not already in it
 *
 * @param item
 * @returns {Array}
 */
Array.prototype.pushUnique = function (item) {
	if (this.indexOf(item) === -1) {
		this.push(item);
	}
	return this;
};

/**
 * Format bytes to human readable unit (kb, mb, gb etc) depending on how many bytes
 *
 * @author https://stackoverflow.com/a/18650828/3334403
 * @param bytes
 * @param decimals
 * @returns {string}
 */
function formatBytes(bytes, decimals = 2) {
	if (bytes === 0) {
		return '0 Bytes';
	}
	const k = 1024;
	decimals = decimals < 0 ? 0 : decimals;
	const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
	let i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Generate human readable datetime
 *
 * @param returnObject return object instead string
 * @returns string | object
 */
Date.prototype.human = function (returnObject = false) {
	let res = {
		milisecond: (this.getMilliseconds() + '').pad(3, '0', 'left') + '',
		second: (this.getSeconds() + '').pad(2, '0', 'left') + '',
		minute: (this.getMinutes() + '').pad(2, '0', 'left') + '',
		hour: (this.getHours() + '').pad(2, '0', 'left') + '',
		day: (this.getDate() + '').pad(2, '0', 'left') + '',
		month: (this.getMonth() + 1 + '').pad(2, '0', 'left') + '',
		year: (this.getFullYear() + '').pad(2, '0', 'left') + ''
	};
	res.date = res.year + '.' + res.month + '.' + res.day;
	res.time = res.hour + ':' + res.minute + ':' + res.second;
	res.toString = function () {
		return (res.date + ' ' + res.time + '.' + res.milisecond);
	};
	if (returnObject === true) {
		return res;
	} else {
		return res.toString();
	}
};

/**
 * Check, if value is numeric (number as string)
 */
global.isNumeric = isNumeric;
function isNumeric(n) {
	return !isNaN(parseFloat(n)) && isFinite(n);
}

/**
 * Format miliseconds to human redable string, 10d 2h 52m 684ms
 *
 * @param {int} miliseconds
 * @returns {String}
 */
global.msToHuman = msToHuman;
function msToHuman(miliseconds) {
	const milliseconds = Math.floor((miliseconds) % 1000);
	const seconds = Math.floor((miliseconds / (1000)) % 60);
	const minutes = Math.floor((miliseconds / (1000 * 60)) % 60);
	const hours = Math.floor((miliseconds / (1000 * 60 * 60)) % 24);
	const days = Math.floor((miliseconds / (1000 * 60 * 60 * 24)));

	let result = '';
	result += (days > 0 ? ' ' + days + 'd' : '');
	result += (hours > 0 ? ' ' + hours + 'h' : '');
	result += (minutes > 0 ? ' ' + minutes + 'm' : '');
	result += (seconds > 0 ? ' ' + seconds + 's' : '');
	result += (milliseconds > 0 ? ' ' + milliseconds + 'ms' : '');
	return result.trim();
}

/**
 * Format human readable duration string back to miliseconds
 *
 * @param {int} miliseconds
 * @returns {String}
 */
global.humanToMs = humanToMs;
function humanToMs(humanString) {
	let result = 0;
	[
		[/([0-9]+)d/, 1000 * 60 * 60 * 24],
		[/([0-9]+)h/, 1000 * 60 * 60],
		[/([0-9]+)m/, 1000 * 60],
		[/([0-9]+)s/, 1000],
		[/([0-9]+)ms/, 1]
	].forEach(function (timeData) {
		const timeValue = timeData[0].exec(humanString);
		if (timeValue) {
			result += timeValue[1] * timeData[1];
		}
	});
	return result;
}

/**
 * Convert coordinates
 * 50°03'07.8"N 14°27'08.5"E -> 50.052166,14.452364
 * https://stackoverflow.com/a/1140335
 */
global.convertDMSToDD = convertDMSToDD;
function convertDMSToDD(degrees, minutes, seconds, direction) {
	let dd = numberRound(degrees + minutes / 60 + seconds / (60 * 60), 6);
	if (direction === "S" || direction === "W") {
		dd = dd * -1;
	} // Don't do anything for N or E
	return dd;
}

/**
 * Prevent loading files and folders
 *
 * @param {type} path
 */
global.sanatizePath = sanatizePath;
function sanatizePath(path) {
	return path.replace(/(\.\.)|(^\/)/i, '');
}

/**
 * Generate folder for "go back"
 *
 * @param {type} path
 */
global.generateGoBackPath = generateGoBackPath;
function generateGoBackPath(path) {
	let goBackPath = path.split('/');
	goBackPath.splice(goBackPath.length - 2, 1);
	return goBackPath.join('/')
}

/**
 * Round number with supporting floating point
 *
 * @param number
 * @param points How many numbers behind floating point
 * @returns {number}
 */
global.numberRound = numberRound;
function numberRound(number, points) {
	let precision = parseInt('1'.pad((points + 1), '0'));
	return Math.round(number * precision) / precision;
}

/**
 * Generate nice URL to prevent browser escaping into ugly URL encoded
 *
 * /demo/folder with+spaces and+plus signs/
 * ->
 * /demo/folder+with\+spaces+and\+plus+signs/
 */
function pathToUrl(path) {
	// escape + signs
	path = path.replace(/([^\\])\+/g, '$1\\+');
	// replace ' ' with +
	return path.replaceAll(' ', '+');
}

/**
 * Get path from nice URL
 *
 * /demo/folder+with\+spaces+and\+plus+signs/
 * ->
 * /demo/folder with+spaces and+plus signs/
 */
function pathFromUrl(path) {
	// replace spaces (need to check, if + is not escaped)
	path = path.replace(/([^\\])\+/g, '$1 ');
	// remove escaping \\+ to get +
	return path.replaceAll('\\+', '+');
}

/**
 * Copy text into clipboard.
 *
 * @author https://www.w3schools.com/howto/howto_js_copy_clipboard.asp
 * @param text
 * @returns {boolean} true on success, false otherwise
 */
function copyToClipboard(text) {
	// Currently there is no javascript API to put text into clipboard
	// so we have to create input text element and run command "copy"
	let inputDom = document.createElement('input');
	inputDom.setAttribute('type', 'text');
	// element can't be hidden (display: none), select() wouldn't work, but can be out of viewport
	inputDom.setAttribute('style', 'display: block; position: absolute; top: -10em');
	document.body.appendChild(inputDom);
	inputDom.value = text;
	inputDom.select();
	inputDom.setSelectionRange(0, 99999); // for mobile devices
	const success = document.execCommand("copy");
	inputDom.parentNode.removeChild(inputDom);
	return success;
}