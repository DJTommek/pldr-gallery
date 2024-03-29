const c = require(BASE_DIR_GET('/src/libs/config.js'));
const FS = require('fs');
const Archiver = require('archiver');
const LOG = require(BASE_DIR_GET('/src/libs/log.js'));
const getItemsHelper = require(__dirname + '/helpers/getItemsFromFolder.js');

module.exports = function (webserver, endpoint) {

	/**
	 * Directly stream archived file(s) and folder(s) as ZIP file without saving to file.
	 *
	 * @author https://stackoverflow.com/a/25210806/3334403
	 * @returns streamed file if ok
	 * @returns JSON if error
	 */
	webserver.get(endpoint, function (req, res) {
		if (!res.locals.fullPathFolder) {
			return res.result.setError('Invalid path or you dont have a permission.').end(403);
		}
		if (c.archive.enabled !== true) {
			return res.result.setError('Generating archive files are disabled in server config. Check out "config.archive.enabled".').end(403);
		}
		// name generated from folder, which is being archived. For root it is default name
		const zipFile = encodeURI((res.locals.path.split('/').last(2) || 'archive') + '.' + c.archive.format);
		getItemsHelper.files(res.locals.path, res.locals.fullPathFolder, res.locals.user.getPermissions(), {recursive: true}).then(function (data) {
			try {
				const archive = Archiver(c.archive.format, c.archive.options);
				archive.on('error', function (error) {
					LOG.error('(Web) Archiver error while generating archive file for path "' + res.locals.path + '": ' + error.message);
					return res.result.setError('Archiver error while generating archive file.').end(500);
				});
				archive.on('warning', function (error) {
					LOG.error('(Web) Archiver warning while generating archive file for path "' + res.locals.path + '": ' + error.message);
				});
				archive.pipe(res);
				for (const item of data.items) {
					const pathInArchive = item.path.replace(res.locals.path, '');
					if (item.isFile) {
						archive.file(c.path + item.path, {name: pathInArchive});
					}
				}
				res.writeHead(200, {
					'Content-Type': 'application/zip',
					'Content-Disposition': 'attachment; filename="' + zipFile + '"'
				});
				archive.finalize();
				LOG.info('(Web) Creating and streaming zip file to download: ' + res.locals.path);
			} catch (error) {
				LOG.error('(Web) Error while generating archive file for path "' + res.locals.path + '": ' + error.message);
				return res.result.setError('Error while generating archive file.').end(500);
			}
		});
	});
};
