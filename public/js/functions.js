/**
 * If some function should be accessed in node.js backend, must be also defined in "global"-
 * There is nothing like that in browser and to preserve browser errors, create empty object for it.
 */
global = (typeof global === 'undefined') ? {} : global;

/**
 * Replace all elements in string
 *
 * @param search
 * @param replacement
 * @returns {string}
 */
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
 * Return last element of array without updating array itself
 *
 * @param {Number} [last] which index from last element
 * @return {*|undefined} last element of array or undefined
 */
Array.prototype.last = function (last) {
	if (last === undefined) {
		last = 1;
	} else if (typeof last !== 'number' || last < 1) {
		throw new Error('Parameter "last" has to be positive number.')
	}
	return this[this.length - last];
};

/**
 * Return true if value is in array
 *
 * @param element
 * @returns {boolean}
 */
Array.prototype.inArray = function (element) {
	return (this.indexOf(element) >= 0)
};

/**
 * Remove all item(s) from array by value
 *
 * @param value
 * @returns {Array}
 */
Array.prototype.removeByValue = function (value) {
	while (true) {
		let index = this.indexOf(value);
		if (index === -1) {
			break
		}
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
	if (this.inArray(item) === false) {
		this.push(item);
	}
	return this;
};

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
 * Format bytes to human readable unit (kb, mb, gb etc) depending on how many bytes
 *
 * @author https://stackoverflow.com/a/18650828/3334403
 * @param {Number} bytes
 * @param {Number} [decimals]
 * @returns {string}
 */
function formatBytes(bytes, decimals = 2) {
	if (typeof bytes !== 'number' || bytes < 0) {
		throw new Error('Parameter "bytes" has to be positive number.')
	}
	if (typeof decimals !== 'number' || decimals < 0) {
		throw new Error('Parameter "decimals" has to be positive number.')
	}
	if (bytes === 0) {
		return '0 B';
	}
	const k = 1024;
	decimals = decimals < 0 ? 0 : decimals;
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
	let i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}
global.formatBytes = formatBytes;

/**
 * Check, if value is numeric (number as string)
 */
function isNumeric(n) {
	return !isNaN(parseFloat(n)) && isFinite(n);
}
global.isNumeric = isNumeric;

/**
 * Format miliseconds to human redable string, 10d 2h 52m 684ms
 *
 * @param {int} miliseconds
 * @returns {String}
 */
global.msToHuman = msToHuman;
function msToHuman(miliseconds) {
	if (typeof miliseconds !== 'number' || miliseconds < 0) {
		throw new Error('Parameter "miliseconds" has to be positive number.');
	}
	if (miliseconds === 0) {
		return '0ms';
	}
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
 * @TODO throw error if input string is not valid human readable duration
 * @param {string} human readable duration
 * @returns {String}
 */
global.humanToMs = humanToMs;
function humanToMs(human) {
	if (typeof human !== 'string') {
		throw new Error('Parameter "human" has to be string.');
	}
	let result = 0;
	[
		[/([0-9]+)d/, 1000 * 60 * 60 * 24],
		[/([0-9]+)h/, 1000 * 60 * 60],
		[/([0-9]+)m([^s]|$)/, 1000 * 60],
		[/([0-9]+)s/, 1000],
		[/([0-9]+)ms/, 1]
	].forEach(function (timeData) {
		const timeValue = timeData[0].exec(human);
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
 * Generate folder for "go back"
 *
 * @see test/functions.js
 * @param {string} path
 */
function generateGoBackPath(path) {
	if (typeof path !== 'string') {
		throw new Error('Parameter "path" has to be string.')
	}
	if (path === '/') {
		throw Error('Path can\'t be root')
	}
	let goBackPath = path.split('/');
	goBackPath.splice(goBackPath.length - 2, 1);
	return goBackPath.join('/')
}
global.generateGoBackPath = generateGoBackPath;

/**
 * Round number with supporting floating point
 *
 * @param number
 * @param points How many numbers behind floating point
 * @returns {number}
 */
function numberRound(number, points) {
	let precision = parseInt('1'.pad((points + 1), '0'));
	return Math.round(number * precision) / precision;
}
global.numberRound = numberRound;

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