require('../src/webserver/private/js/functions.js');
const pathCustom = require('../src/libs/path.js');
pathCustom.defineBaseDir(require.main.filename + '../../../../../../');
const c = require(BASE_DIR_GET('/src/libs/config.js'));
const LOG = require(BASE_DIR_GET('/src/libs/log.js')).setPath(BASE_DIR_GET('/data/log-test/'));
require(BASE_DIR_GET('/src/webserver/webserver.js'));
const http = require('http');
const https = require('http');
const querystring = require('querystring');
const perms = require(BASE_DIR_GET('/src/libs/permissions.js'));
perms.load();

describe('Integrations - Webserver Structure', function () {
	const apiPath = '/api/structure';
	it('Invalid - missing path', function (done) {
		assertRequest(apiPath, {}, function(result) {
			if (result.error === true && result.result.length === 0 && result.message === 'Zadaná cesta "<b>undefined</b>" není platná nebo na ni nemáš právo.') {
				done();
			}
		});
	});
	it('Valid - root', function (done) {
		assertRequest(apiPath, {path: stringToBase64('/')}, function(result) {
			if (result.error === false &&
				result.result.foldersTotal === 8 && result.result.folders.length === 8 &&
				result.result.folders.some(item => item.path === '/sort-test/') &&
				result.result.folders.some(item => item.path === '/special-characters/') &&
				result.result.files.length === 3 && result.result.filesTotal === 3 &&
				result.result.files.some(item => item.path === '/image-1.jpg' && item.size === 25637) &&
				result.result.header !== null && result.result.footer !== null
			) {
				done();
			}
		});
	});
	it('Valid - empty folder', function (done) {
		assertRequest(apiPath, {path: stringToBase64('/empty folder/')}, function(result) {
			if (result.error === false &&
				result.result.foldersTotal === 0 && result.result.folders.length === 1 && // "go back" dont count in total folders
				result.result.folders[0].path === '/' &&
				result.result.files.length === 0 && result.result.filesTotal === 0 &&
				result.result.header === null && result.result.footer === null
			) {
				done();
			}
		});
	});
	it('Valid - load coords from EXIF files', function (done) {
		assertRequest(apiPath, {path: stringToBase64('/map from EXIF/')}, function(result) {
			if (result.error === false &&
				result.result.foldersTotal === 0 && result.result.folders.length === 1 && // "go back" dont count in total folders
				result.result.files.length === 6 && result.result.filesTotal === 6 &&
				result.result.files[0].path === '/map from EXIF/20190811_111921.jpg' &&
				result.result.files[0].coordLat === 50.698351 &&
				result.result.files[0].coordLon === 15.736727 &&
				result.result.header !== null && result.result.footer === null
			) {
				done();
			}
		});
	});

	// Handling special characters like these: ()[]+
	// @see https://github.com/DJTommek/pldr-gallery/issues/7
	it('Valid - special characters (micromatch bug - base)', function (done) {
		const path = '/special-characters/micromatch/';
		assertRequest(apiPath, {path: stringToBase64(path)}, function(result) {
			if (result.error === false &&
				result.result.foldersTotal === 3 && result.result.folders.length === 4 && // "go back" dont count in total folders
				result.result.files.length === 0 && result.result.filesTotal === 0 &&
				result.result.folders[1].path === path + 'some (parenthess)/' &&
				result.result.folders[2].path === path + 'some [parenthess]/' &&
				result.result.folders[3].path === path + 'some+plus/'
			) {
				done();
			}
		});
	});

	// Handling special characters like these: ()[]+
	// @see https://github.com/DJTommek/pldr-gallery/issues/7
	it('Valid - special characters (micromatch bug - in () folder)', function (done) {
		const path = '/special-characters/micromatch/some (parenthess)/';
		assertRequest(apiPath, {path: stringToBase64(path)}, function(result) {
			if (result.error === false &&
				result.result.foldersTotal === 1 && result.result.folders.length === 2 && // "go back" dont count in total folders
				result.result.files.length === 1 && result.result.filesTotal === 1 &&
				result.result.folders[1].path === path + 'placeholder empty folder/' &&
				result.result.files[0].path === path + 'placeholder sample image.jpg'
			) {
				done();
			}
		});
	});
	it('Valid - special characters (micromatch bug - in () folder)', function (done) {
		const path = '/special-characters/micromatch/some [parenthess]/';
		assertRequest(apiPath, {path: stringToBase64(path)}, function(result) {
			if (result.error === false &&
				result.result.foldersTotal === 1 && result.result.folders.length === 2 && // "go back" dont count in total folders
				result.result.files.length === 1 && result.result.filesTotal === 1 &&
				result.result.folders[1].path === path + 'placeholder empty folder/' &&
				result.result.files[0].path === path + 'placeholder sample image.jpg'
			) {
				done();
			}
		});
	});
	it('Valid - special characters (micromatch bug - in + folder)', function (done) {
		const path = '/special-characters/micromatch/some+plus/';
		assertRequest(apiPath, {path: stringToBase64(path)}, function(result) {
			if (result.error === false &&
				result.result.foldersTotal === 1 && result.result.folders.length === 2 && // "go back" dont count in total folders
				result.result.files.length === 1 && result.result.filesTotal === 1 &&
				result.result.folders[1].path === path + 'placeholder empty folder/' &&
				result.result.files[0].path === path + 'placeholder sample image.jpg'
			) {
				done();
			}
		});
	});
});

function stringToBase64(string) {
	return (new Buffer.from(string)).toString('base64')
}

function assertRequest(path, query, callback) {
	const options = {
		hostname: 'localhost',
		port: c.http.port,
		path: path,
		method: 'GET'
	};
	options.path += '?' + querystring.stringify(query);
	// switch to HTTPS if is enabled in config
	let requestLibrary = http;
	if (c.http.ssl.enable === true) {
		requestLibrary = https;
		options.port = c.http.ssl.port;
	}
	const request = requestLibrary.request(options, function (res) {
		let textResponse = '';
		res.on('data', function (chunk) {
			textResponse += chunk;
		});
		res.on('end', function () {
			callback(JSON.parse(textResponse));
		});
	});
	request.on('error', function (error) {
		throw new Error('Webserver request error: ' + error.message);
	});
	request.on('socket', function (socket) {
	});
	request.on('timeout', function () {
		throw new Error('Webserver request timeout.');
	});
	request.end();
}

