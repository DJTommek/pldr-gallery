const FS = require('fs');
const LOG = require(BASE_DIR_GET('/libs/log.js'));
const perms = require(BASE_DIR_GET('/libs/permissions.js'));

const getItemsHelper = require(__dirname + '/helpers/getItemsFromFolder.js');

require(BASE_DIR_GET('/private/js/class/FileExtensionMapper.js'));
require(BASE_DIR_GET('/private/js/class/Icon.js'));
require(BASE_DIR_GET('/private/js/class/Item.js'));

module.exports = function (webserver, endpoint) {

	/**
	 * Load list items (of files and folders) from given path
	 *
	 * @returns JSON
	 */
	webserver.get(endpoint, function (req, res) {
		res.statusCode = 200;
		res.setHeader("Content-Type", "application/json");
		if (!res.locals.fullPathFolder) {
			res.result.setError('Zadaná cesta "<b>' + res.locals.queryPath + '</b>" není platná nebo na ni nemáš právo.').end();
			return;
		}

		let itemLimit = parseInt(req.cookies['pmg-item-limit']);
		if (itemLimit <= 0) {
			itemLimit = 1000;
		}

		function generateSpecificFilePromise(filename) {
			return new Promise(function (resolve) {
				if (perms.test(res.locals.userPerms, res.locals.path + filename) === false) { // user dont have permission to this file
					return resolve(null);
				}
				FS.readFile(res.locals.fullPathFolder + filename, function (error, data) {
					if (error) {
						if (error.code !== 'ENOENT') { // some other error than just missing file
							LOG.error('Error while loading "' + res.locals.path + filename + '": ' + error)
						}
						return resolve(null)
					}
					resolve(data.toString());
				});
			});
		}

		Promise.all([
			getItemsHelper.folders(res.locals.path, res.locals.fullPathFolder, res.locals.userPerms, {limit: itemLimit}),
			getItemsHelper.files(res.locals.path, res.locals.fullPathFolder, res.locals.userPerms, {limit: itemLimit, coords: true, stat: true}),
			generateSpecificFilePromise('header.html'),
			generateSpecificFilePromise('footer.html'),
		]).then(function (data) {
			res.result.setResult({
				folders: data[0][0].map(x => x.serialize()),
				foldersTotal: data[0][1],
				foldersLimit: data[0][2],
				foldersOffset: data[0][3],
				files: data[1][0].map(x => x.serialize()),
				filesTotal: data[1][1],
				filesLimit: data[1][2],
				filesOffset: data[1][3],
				header: data[2],
				footer: data[3]
			}).end();
		});
	});
};
