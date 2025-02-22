require('./private/js/functions.js');
const CONFIG = require('../libs/config.js');
const LOG = require('../libs/log.js');

const FS = require("fs");
const PATH = require('path');
const terser = require('terser');
const structureRepository = require('../libs/repository/structure.js');

/**
 * Generate public/index.html
 *
 * - run cachebuster by replacing every variable {{CACHEBUSTER_<FILE_PATH>}} with modified time in miliseconds
 * 	 For example, if "public/main.css" was lastly modified at 2020-01-01 00:00:00, string {{CACHEBUSTER_PUBLIC_MAIN.CSS}} will be replaced with 1577833200000
 *   In your code:
 *   <link rel="stylesheet" href="main.css?{{CACHEBUSTER_PUBLIC_MAIN.CSS}}">
 *   Will be replaced with:
 *   <link rel="stylesheet" href="main.css?1577833200000">
 */
module.exports.generateIndexHtml = function() {
	FS.readFile(BASE_DIR_GET('/src/webserver/private/index.html'), function (error, data) {
		if (error) {
			LOG.fatal('Cannot load private index file for generating public index.html, error: ' + error.message);
		}
		let promises = [];
		let fileContent = data.toString();
		[
			'private/less/main.less',
			'public/js/main.js',
		].forEach(function (file) {
			const htmlVariable = '{{CACHEBUSTER_' + file.replaceAll('/', '_').toUpperCase() + '}}';
			promises.push(new Promise(function (resolve) {
				FS.stat(BASE_DIR_GET('/src/webserver/' + file), function (error, data) {
					if (error) {
						LOG.error('Error while creating cachebuster variable for "' + file + '": ' + error.message);
						resolve();
						return;
					}
					resolve({name: htmlVariable, value: Math.floor(data.mtimeMs)});
				});
			}));
		});

		Promise.all(promises).then(async function (data) {
			data.forEach(function (replacePair) {
				if (replacePair) {
					fileContent = fileContent.replace(replacePair.name, replacePair.value);
				}
			});
			fileContent = fileContent.replace('{{CACHEBUSTER_PUBLIC_JS_MODULES_MIN.JS}}', getNewestFileUpdateTime(CONFIG.terser.filesToCompile).toString());
			fileContent = fileContent.replace('{{FILE_SIZE_PERCENTILES}}', JSON.stringify(await structurePercentiles()));
			// share some of server-side variables to FE
			fileContent = fileContent.replace('{{SERVER_CONFIG}}', JSON.stringify({
				thumbnails: {
					width: CONFIG.thumbnails.width,
					height: CONFIG.thumbnails.height,
					image: {
						enabled: CONFIG.thumbnails.image.enabled,
					},
					folder: {
						enabled: CONFIG.thumbnails.folder.enabled,
					},
					video: {
						enabled: CONFIG.thumbnails.video.enabled,
					},
				},
				archive: {
					enabled: CONFIG.archive.enabled,
				},
				upload: {
					fileMaxSize: CONFIG.upload.fileMaxSize,
					allowedExtensions: CONFIG.upload.allowedExtensions,
				},
			}));
			// build final index file
			FS.writeFile(BASE_DIR_GET('/temp/webserver/public/index.html'), fileContent, function (error) {
				if (error) {
					LOG.fatal('(Webserver) Fatal error while saving generated public/index.html file: ' + error.message);
				} else {
					LOG.info('(Webserver) Main public/index.html was successfully generated.');
				}
			});
		});
	});
}

/**
 * Generate one javascript file with all necessary javascript classes
 */
module.exports.generateModulesJs = function () {
	let finalContent = '';
	CONFIG.terser.filesToCompile.forEach(function (file) {
		finalContent += FS.readFileSync(BASE_DIR_GET(file));
	});
	terser.minify(finalContent, CONFIG.terser.options).then(function (finalContentUgly) {
		FS.mkdir(PATH.dirname(CONFIG.terser.destinationPath), {recursive: true}, function (error) {
			if (error) {
				LOG.error('(Cache) Error while creating folder for generated modules: ' + error.message);
			} else {
				FS.writeFile(CONFIG.terser.destinationPath, finalContentUgly.code, function (error) {
					if (error) {
						LOG.fatal('(Webserver) Fatal error while saving generated public/js/modules.min.js file: ' + error.message);
					} else {
						LOG.info('(Webserver) Main public/js/modules.min.js file was successfully generated.');
					}
				});
			}
		});
	}).catch(function (error) {
		LOG.fatal('(Webserver) Fatal error while terser.minify of public/js/modules.min.js file: ' + error.message);
	});
}

/**
 * Check all files for last update time and return the newest time
 *
 * @param {[string]} files which should be checked
 * @returns {number} UNIX time in milliseconds
 */
function getNewestFileUpdateTime(files) {
	let lastUpdateTime = 0;
	files.forEach(function (file) {
		const fileStats = FS.statSync(BASE_DIR_GET(file));
		lastUpdateTime = (fileStats.mtimeMs > lastUpdateTime) ? fileStats.mtimeMs : lastUpdateTime;
	});
	return Math.floor(lastUpdateTime);
}

async function structurePercentiles() {
	const percentiles = [
		0, 0.01,
		0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9,
		0.99, 1
	];
	return structureRepository.sizePercentiles(percentiles);
}
