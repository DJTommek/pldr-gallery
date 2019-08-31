var fs = require('fs');
var readline = require('readline');
module.exports.INFO = 0;
module.exports.ERROR = 1;
module.exports.DEBUG = 3;
module.exports.WEBSERVER = 4;
module.exports.SQL = 5;
module.exports.FATAL_ERROR = 6;
module.exports.UNCAUGHT_EXCEPTION = 7;

var folders = [
    './log',
    './log/sql',
    './log/webserver'
];

module.exports.log = function (msg, type, parameters)
{
    if (!parameters) {
        parameters = {};
    }
    var datetime = new Date().human(true);

    var basePath = './log/';
    var filePath = basePath;
    var mainLog = true;
    var toConsole = true;
    var quit = false;

    switch (type) {
        case this.ERROR:
            mainLog = true;
            filePath += datetime.date + '_error';
            break;
        case this.FATAL_ERROR:
            mainLog = true;
            filePath += datetime.date + '_error';
            quit = true;
            msg = '[FATAL ERROR] ' + msg;
            break;
        case this.UNCAUGHT_EXCEPTION:
            mainLog = false;
            toConsole = true;
            filePath += datetime.date + '_exception';
            break;
        case this.WEBSERVER:
            mainLog = false;
//            toConsole = false;
            filePath += 'webserver/webserver_' + datetime.date;
            break;
        case this.DEBUG:
            mainLog = false;
            filePath += datetime.date + '_debug';
            break;
        case this.SQL:
            mainLog = false;
            toConsole = false;
            filePath += 'sql/sql_' + datetime.date;
            break;
        case this.INFO:
        default:
            mainLog = true;
            toConsole = true;
            break;
    }

    var log = '[' + datetime.date + ' ' + datetime.time + '.' + datetime.milisecond + '] ' + msg;

    // override default logging to console
    if (parameters.console === true) {
        toConsole = true;
    } else if (parameters.console === false) {
        toConsole = false;
    }

    if (toConsole) {
        console.log(log);
    }
    try {
        if (mainLog) {
            fs.appendFileSync(basePath + datetime.date + '.txt', log + '\n', 'utf8');
        }
    } catch (error) {
        console.error('Cant log into mainlog: [This message is not saved]');
        console.error(error);
    }
    try {
        if (filePath !== basePath) {
            fs.appendFileSync(filePath + '.txt', log + '\n', 'utf8');
        }
    } catch (error) {
        console.error('Cant log into separate log: [This message is not saved]');
        console.error(error);
    }
    if (quit === true) {
        process.exit();
    }
}

module.exports.head = function (text, type)
{
    this.log('***' + text + '***', type);
}

module.exports.getLogsList = function () {
    var filesDay = {};
    folders.forEach(function (folderName) {
        fs.readdirSync(folderName).forEach(function (fileName) {
            if (fileName.match(/\.txt$/)) {
                var re_day = /[0-9]{4,4}\.[0-9]{2,2}\.[0-9]{2,2}/;
                var day = re_day.exec(fileName)[0];

                // pokud jeste neexistuje, zalozime
                if (!filesDay[day]) {
                    filesDay[day] = {};
                }
                if (fileName.match('sql_')) {
                    filesDay[day].sql = fileName;
                } else if (fileName.match('webserver_')) {
                    filesDay[day].webserver = fileName;
                } else if (fileName.match('messages_')) {
                    filesDay[day].messages = fileName;
                } else if (fileName.match('_debug')) {
                    filesDay[day].debug = fileName;
                } else if (fileName.match('_error')) {
                    filesDay[day].error = fileName;
                } else if (fileName.match('_exception')) {
                    filesDay[day].exception = fileName;
                } else {
                    filesDay[day]._ = fileName;
                }
            }
        });
    });
    return filesDay;
}

/**
 * Ziskat obsah log souboru
 * 
 * @param {JSON} options
 * - *file: ktery log chceme cist
 * - limit: kolik radku chceme mit (default 1000), 0 = vsechny
 * - offset: kolik radku se ma preskocit (default 0)
 * - order: razeni logu (default 'asc'), 'desc' = nejnovejsi radky prvni
 * @param {function} callback
 */
module.exports.readLog = function (options, callback)
{
    try {
        var re_file = /^([0-9]{4}\.[0-9]{2}\.[0-9]{2})(_(error|debug|exception|messages|sql|webserver))?$/
        var fileMatch = re_file.exec(options.file);
        if (!fileMatch) {
            throw 'Invalid file';
        }
        var fileLoad = './log/';
        // prefix souboru a podslozka zaroven
        if (fileMatch[3] && fileMatch[3].match(/^(messages|sql|webserver)$/)) {
            fileLoad += fileMatch[3] + '/' + fileMatch[3] + '_';
            fileLoad += fileMatch[1];
            // suffix souboru bez podslozky
        } else if (fileMatch[3] && fileMatch[3].match(/^(debug|error|exception)$/)) {
            fileLoad += fileMatch[1] + '_' + fileMatch[3];
        } else {
            fileLoad += fileMatch[1];
        }
        fileLoad += '.txt';
    } catch (error) {
        return (typeof callback === 'function' && callback(error));
    }

    // Vychozi hodnoty
    options.limit = ((typeof options.limit === 'number' && options.limit > -1) ? options.limit : 1000);
    // @TODO - neni implementovano ve cteni souboru
    options.offset = ((typeof options.offset === 'number' && options.offset > -1) ? options.offset : 0);
    options.order = (options.order === 'desc' ? 'desc' : 'asc');

    var fileStream = fs.createReadStream(fileLoad)
    fileStream.on('error', function (error) {
        return (typeof callback === 'function' && callback(error + ''));
    });
    var readLogfile = readline.createInterface({
        input: fileStream
    });
    var lines = [];
    readLogfile.on('line', function (line) {
        if (options.limit > 0 && lines.length >= options.limit) {
            // Chceme jen posledních x řádků, udržujeme velikost pole
            // tj. u kazdeho pridaneho prvku je potreba odstranit prvni prvek v poli
            if (options.order === 'desc') {
                lines.shift();
            } else {
                readLogfile.close();
            }
        }
        lines.push(line);
    });
    readLogfile.on('close', function () {
        if (options.order === 'desc') {
            lines = lines.reverse();
        }
        return (typeof callback === 'function' && callback(false, lines));
    });
}

function checkAndCreateFolders() {
    try {
        folders.forEach(function (folder) {
            if (!fs.existsSync(folder)) {
                console.log('(Log) Missig folder "' + folder + '", creating new. [This message is not saved]');
                fs.mkdirSync(folder);
            }
        });
    } catch (error) {
        console.error("(Log) Error while creating folders to log, more info below. [This message is not saved]");
        console.error(error);
        process.exit();
    }
}
checkAndCreateFolders();

process.on('uncaughtException', function (error) {
    module.exports.log(error.message + ' - more in exception log.', module.exports.ERROR);
    module.exports.log(error.stack, module.exports.UNCAUGHT_EXCEPTION);
});
