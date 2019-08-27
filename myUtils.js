require('./public/js/functions.js');
var fs = require('fs');
var c = require('./config');
var e = require('./enum.js');
var https = require('https');

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.split(search).join(replacement);
};

// @TODO import .human() from other nodejs projects
module.exports.formatDateTime = function(datetime, returnArray){
    var res = {
        milisecond: String(datetime.getMilliseconds()).pad(3, '0', 'left'),
        second: String(datetime.getSeconds()).pad(2, '0', 'left'),
        minute: String(datetime.getMinutes()).pad(2, '0', 'left'),
        hour: String(datetime.getHours()).pad(2, '0', 'left'),
        day: String(datetime.getDate()).pad(2, '0', 'left'),
        month: String(datetime.getMonth()+1).pad(2, '0', 'left'),
        year: String(datetime.getFullYear()).pad(2, '0', 'left')
    }
    res.date = res.year + '.' + res.month + '.' + res.day;
    res.time = res.hour + ':' + res.minute + ':' + res.second;

    if (returnArray === true) {
        return res;
    } else {
        return (res.date + ' ' + res.time + '.' + res.milisecond);
    }
}

module.exports.log = function(msg, type)
{
    switch (type) {
        case e.LOG.ERROR:
            var fileSuffix = '_error';
            break;
        case e.LOG.INFO:
        default:
            var fileSuffix = null;
            break;
    }
    var datetime = this.formatDateTime(new Date(), true);

    var log = '[' + datetime.date + ' ' + datetime.time + '.' + datetime.milisecond + '] ' + msg;
    console.log(log);
	fs.appendFileSync('./log/' + datetime.date + '.txt', log + '\n', 'utf8');
	if (fileSuffix !== null) {
		fs.appendFileSync('./log/' + datetime.date + fileSuffix + '.txt', log + '\n', 'utf8');
	}
}

module.exports.head = function(text)
{
    this.log('***' + text + '***');
}

module.exports.isNumeric = function(n) {
	return !isNaN(parseFloat(n)) && isFinite(n);
}

module.exports.apiResponse = function(json)
{
    return JSON.stringify(json, null, 4);
}
