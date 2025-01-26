const CONFIG = require(BASE_DIR_GET('/src/libs/config.js'));
const Archiver = require('archiver');
const LOG = require(BASE_DIR_GET('/src/libs/log.js'));
const structureRepository = require('../../../libs/repository/structure');
const sqlUtils = require('../../../libs/repository/sqlUtils.js');

module.exports = function (webserver, endpoint) {
	/**
	 * Directly stream archived file(s) and folder(s) as ZIP file without saving to file.
	 *
	 * @author https://stackoverflow.com/a/25210806/3334403
	 * @returns streamed file if ok
	 * @returns JSON if error
	 */
	webserver.get(endpoint, async function (req, res) {
		if (CONFIG.archive.enabled !== true) {
			return res.result.setError('Downloading directory as archive is disabled.').end(400);
		}

		/** @var {FolderItem|null} */
		const directoryItem = res.locals.pathItem;
		if (directoryItem?.isFolder !== true) {
			return res.result.setError('Invalid path or you dont have a permission.').end(403);
		}

		try {
			const searchOptions = {
				type: structureRepository.TYPE_FILE
			};
			const searchQuery = structureRepository.search(directoryItem.path, searchOptions);
			searchQuery.andWhere(function () {
				for (const permission of res.locals.user.getPermissions()) {
					// 'orWhereLike()' cannot be used due to bug of forcing COLLATE, which slows down the query
					// @link https://github.com/knex/knex/issues/5143 whereLike does not work with the MySQL utf8mb4 character set
					this.orWhere('path', 'LIKE', sqlUtils.escapeLikeCharacters(permission) + '%');
				}
			});

			const archive = Archiver(CONFIG.archive.format, CONFIG.archive.options);
			archive.on('error', function (error) {
				LOG.error('(Web) Archiver error while generating archive file for path "' + directoryItem + '": ' + error.message);
				throw error;
			});
			archive.on('warning', function (error) {
				LOG.error('(Web) Archiver warning while generating archive file for path "' + directoryItem + '": ' + error.message);
			});
			archive.pipe(res);

			for await (const row of searchQuery.stream()) {
				/** @type {FileItem} */
				const fileItem = structureRepository.rowToItem(row);
				const pathInArchive = fileItem.path.replace(directoryItem.path, '');
				archive.file(CONFIG.path + fileItem.path, {name: pathInArchive});
			}

			// Name generated from folder, which is being archived.
			const archiveName = encodeURI((directoryItem.basename || 'archive') + '.' + CONFIG.archive.format);
			res.writeHead(200, {
				'Content-Type': 'application/zip',
				'Content-Disposition': 'attachment; filename="' + archiveName + '"'
			});
			await archive.finalize();
			LOG.info('(Web) Creating and streaming zip file to download: ' + directoryItem);
		} catch (error) {
			LOG.error('(Web) Error while generating archive file for path "' + directoryItem + '": ' + error.message);
			return res.result.setError('Error while generating archive file for directory "' + directoryItem + '", try again later.').end(500);
		}
	});
};
