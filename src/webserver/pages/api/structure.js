const FS = require('fs');
const LOG = require(BASE_DIR_GET('/src/libs/log.js'));
const perms = require(BASE_DIR_GET('/src/libs/permissions.js'));

const getItemsHelper = require(__dirname + '/helpers/getItemsFromFolder.js');

require(BASE_DIR_GET('/src/webserver/private/js/class/FileExtensionMapper.js'));
require(BASE_DIR_GET('/src/webserver/private/js/class/Icon.js'));
require(BASE_DIR_GET('/src/webserver/private/js/class/Item.js'));

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
				if (res.locals.user.testPathPermission(res.locals.path + filename) === false) { // user dont have permission to this file
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

		res.startTime('apistructure', 'Loading and processing data');
		Promise.all([
			getItemsHelper.itemsDb(res.locals.path, res.locals.fullPathFolder, res.locals.user.getPermissions(), {limit: itemLimit}),
			generateSpecificFilePromise('header.html'),
			generateSpecificFilePromise('footer.html'),
		]).then(function (data) {
			res.endTime('apistructure');
			res.result.setResult({
				folders: data[0].folders.map(x => x.serialize()),
				foldersTotal: data[0].folders.total,
				foldersLimit: data[0].limit,
				foldersOffset: data[0].offset,
				files: data[0].files.map(x => x.serialize()),
				filesTotal: data[0].files.total,
				filesLimit: data[0].limit,
				filesOffset: data[0].offset,
				header: data[1],
				footer: data[2]
			}).end();
		});
	});
};
