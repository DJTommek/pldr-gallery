const FS = require('fs');
const HFS = require('./helperFileSystem');
const PATH = require('path');

module.exports.INFO = 0;
module.exports.ERROR = 1;
module.exports.MSG = 2;
module.exports.DEBUG = 3;
module.exports.WEBSERVER = 4;
module.exports.SQL = 5;
module.exports.FATAL_ERROR = 6;
module.exports.UNCAUGHT_EXCEPTION = 7;
module.exports.WARNING = 8;

let logsPath = '';
module.exports.setPath = function (path) {
	logsPath = path;
	checkAndCreateFolders();
	return this;
};

const baseLogFileFormat = '{date}';
const fileExtension = 'txt';
const defaultLogData = {
	fileFormat: '{date}',
	messageFormat: '{message}',
	messageSuffix: '',
	toMainLog: true,
	console: true,
	quit: false,
	color: '',
};

const logsData = {
	[this.INFO]: {},
	[this.WARNING]: {
		fileFormat: '{date}_warning',
		color: '\x1b[33m', // yellow
	},
	[this.ERROR]: {
		fileFormat: '{date}_error',
		color: '\x1b[31m', // red
	},
	[this.FATAL_ERROR]: {
		fileFormat: '{date}_error',
		messageFormat: '[FATAL ERROR] {message}',
		color: '\x1b[31m', // red
		quit: true,
	},
	[this.UNCAUGHT_EXCEPTION]: {
		fileFormat: '{date}_exception',
		messageFormat: '[UNCAUGHT EXCEPTION] {message}',
		color: '\x1b[31m', // red
	},
	[this.MSG]: {
		fileFormat: 'messages/message_{date}',
		mainLog: false,
		console: false,
	},
	[this.WEBSERVER]: {
		fileFormat: 'webserver/webserver_{date}',
		mainLog: false,
		console: false,
	},
	[this.SQL]: {
		fileFormat: 'sql/sql_{date}',
		mainLog: false,
		console: false,
	},
	[this.DEBUG]: {
		fileFormat: '{date}_debug',
		mainLog: false,
	},
};

/*
 * Shortcuts
 */
module.exports.info = function (msg, parameters) {
	this.log(msg, this.INFO, parameters);
};
module.exports.error = function (msg, parameters) {
	this.log(msg, this.ERROR, parameters);
};
module.exports.msg = function (msg, parameters) {
	this.log(msg, this.MSG, parameters);
};
module.exports.debug = function (msg, parameters) {
	this.log(msg, this.DEBUG, parameters);
};
module.exports.webserver = function (msg, parameters) {
	this.log(msg, this.WEBSERVER, parameters);
};
module.exports.sql = function (msg, parameters) {
	this.log(msg, this.SQL, parameters);
};
module.exports.fatal = function (msg, parameters) {
	this.log(msg, this.FATAL_ERROR, parameters);
};
module.exports.warning = function (msg, parameters) {
	this.log(msg, this.WARNING, parameters);
};

/**
 * Get full LogParams.
 * - get default values
 * - overwrite with values set by specific severity (if any)
 * - overwrite with values set externally (if any)
 *
 * @param {number} severity
 * @param {{}} [customParams]
 * @returns {{}}
 */
function defineLogParameters(severity, customParams) {
	// do not override default object, create new instead and merge new parameters
	let logParams = Object.assign({}, defaultLogData, logsData[severity]);
	logParams['severity'] = severity;

	// override pre-defined settings with custom parameters
	if (customParams) {
		Object.assign(logParams, customParams);
	}
	return logParams;
}

/**
 * Log to console and/or file
 *
 * @param message
 * @param {number} severity
 * @param {{}} [params]
 */
module.exports.log = function (message, severity, params) {
	if (PATH.isAbsolute(logsPath) === false) {
		throw new Error('Base folder where to save logs is not defined. Use setPath("/some/absolute/path/") first.');
	}
	const logParams = defineLogParameters(severity, params);
	const datetime = new Date().human(true);
	const content = '[' + datetime.toString() + '] ' + logParams.messageFormat.formatUnicorn({'message': message});

	// Show log in console
	if (logParams.console) {
		console.log(logParams.color + content + '\x1b[0m');
	}
	// Log into mainlog file
	if (logParams.toMainLog) {
		FS.appendFileSync(logsPath + baseLogFileFormat.formatUnicorn({'date': datetime.date}) + '.txt', content + '\n', 'utf8');
	}
	// Log into separated log file if requested
	try {
		if (logParams.fileFormat) {
			const file = logsPath + logParams.fileFormat.formatUnicorn({'date': datetime.date}) + '.' + fileExtension;
			FS.appendFileSync(file, content + '\n', 'utf8');
		}
	} catch (error) {
		console.error('Cant log into separate log: [This message is not saved]');
		console.error(error);
	}
	// Exit application if necessary
	if (logParams.quit === true) {
		process.exit();
	}
};

module.exports.head = function (text, type, params) {
	this.log('***' + text + '***', type, params);
};

/**
 * Get list of all available logs grouped by days
 * Note: synchronous operations, possible slowing down
 *
 * @returns {{}}
 */
module.exports.getLogsList = function () {
	const folders = getAllFolders();
	let filesDay = {};
	folders.forEach(function (folder) {
		// get all files from folder
		let files;
		try {
			files = FS.readdirSync(folder);
		} catch (error) {
			return module.exports.error('Cant read dir "' + folder + '": ' + error.message);
		}
		// check all loaded files
		for (const file of files) {
			if (PATH.extname(file) !== '.' + fileExtension) {
				continue;
			}
			const match = /[0-9]{4}\.[0-9]{2}\.[0-9]{2}/.exec(file);
			if (!match) {
				continue;
			}
			const day = match[0];

			if (!filesDay[day]) {
				filesDay[day] = [];
			}
			// file is valid, save it into {day}
			filesDay[day].push(folder + '/' + file);
		}
	});

	return filesDay;
};

function isFileInAllowedFolders(path) {
	for (const folder of getAllFolders()) {
		if (PATH.dirname(path) === folder) {
			return true;
		}
	}
	return false;
}

/**
 * Get log content
 *
 * @param {{}} options.
 * @param {function} callback
 * @see HFS.readFileContent() for more info
 * @throws Error in case if callback is not function
 */
module.exports.readLog = function (options, callback) {
	if (typeof callback !== 'function') {
		throw new Error('Param callback must be function');
	}
	// check if filename is in one of allowed logs folder
	if (isFileInAllowedFolders(options.file) === false) {
		return callback('Path "' + options.file + '" is not allowed.', []);
	}

	HFS.readFileContent(options, callback);
};

/**
 * Get all files, which could be created
 *
 * @param {Date} [date]
 * @returns {[]}
 */
function getAllFiles(date) {
	if (!(date instanceof Date)) {
		date = new Date();
	}
	const files = [];
	for (let severity in logsData) {
		severity = parseInt(severity); // numeric indexes are converted to string so it needs to be re-converted back to number
		const datetime = date.human(true);
		const logParameters = defineLogParameters(severity);
		files.push(logsPath + logParameters.fileFormat.formatUnicorn({'date': datetime.date}) + '.' + fileExtension);
	}
	return files;
}

/**
 * Get all folders, which should be created to Log work properly
 *
 * @param [date]
 * @returns {[]}
 */
function getAllFolders(date) {
	const allFiles = getAllFiles(date);
	const folders = [];
	allFiles.forEach(function (file) {
		folders.pushUnique(PATH.dirname(file));
	});
	return folders;
}

/**
 * Check if all necessary folders are created. If not, create them
 */
function checkAndCreateFolders() {
	const folders = getAllFolders();

	for (const folder of folders) {
		try {
			if (!FS.existsSync(folder)) {
				FS.mkdirSync(folder);
				console.log('(Log) Folder "' + folder + '" was missing - created new. [This message is not saved]');
			}
		} catch (error) {
			console.error('(Log) Error while creating folders to log: ' + error.message + ' [This message is not saved]');
			process.exit();
		}
	}
}

process.on('uncaughtException', function (error) {
	module.exports.log(error.message + ' - more in exception log.', module.exports.ERROR);
	module.exports.log(error.stack, module.exports.UNCAUGHT_EXCEPTION);
});
