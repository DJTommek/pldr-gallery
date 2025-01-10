const CONFIG = require('./config.js');
const LOG = require('./log.js');
const pathCustom = require('./path.js');
const structureRepository = require('./repository/structure.js');
const cacheHelper = require("../webserver/pages/api/helpers/cache");
const sharp = require("sharp");

let generatorRunning = false;

async function generateAllThumbnails() {
	let counter = 0;

	if (generatorRunning === true) {
		LOG.info('[Image thumbnail generator] Already running...');
		return;
	}
	generatorRunning = true;
	LOG.info('[Image thumbnail generator] Starting generating thumbnails...');
	const generatingStart = process.hrtime();

	try {
		const rowsStream = await structureRepository.all();
		for await (const row of rowsStream) {
			const pathItem = structureRepository.rowToItem(row);
			try {
				const result = await this.generateThumbnail(pathItem)
				if (result === true) {
					counter++;
				}
			} catch (error) {
				LOG.error('[Thumbnail generator] Unable to generate thumbnail for "' + pathItem.path + '", error: "' + error.message + '"');
			}
		}
	} finally {
		let generatingDoneTime = msToHuman(hrtime(process.hrtime(generatingStart)));
		LOG.info('[Image thumbnail generator] Generated ' + counter + ' thumbnails in ' + generatingDoneTime + '.');
		generatorRunning = false;
	}
}

module.exports.generateThumbnails = generateAllThumbnails;

/**
 * @param {FileItem|FolderItem} pathItem
 * @return {Promise<true|null>} Returns true if thumbnail already exists or it was just generated and saved
 */
async function generateThumbnail(pathItem) {
	const cacheFilePath = cacheHelper.getPath(cacheHelper.TYPE.IMAGE, pathItem.path, true);
	if (cacheFilePath !== null) {
		return null; // Thumbnail already exists
	}

	if (pathItem.isImage) {
		await generateImageThumbnail(pathItem);
		return true;
	}

	return null;
}

/**
 *
 * @param pathItem
 * @return {Promise<boolean>}
 */
async function generateImageThumbnail(pathItem) {
	LOG.debug('[Image thumbnail generator] Generating thumbnail for "' + pathItem.path + '"...');
	const fileAbsolutePath = pathCustom.relativeToAbsolute(pathItem.path, CONFIG.path);
	let compressData = Object.assign({}, CONFIG.compress);
	compressData.width = CONFIG.thumbnails.width;
	compressData.height = CONFIG.thumbnails.height;
	compressData.fit = CONFIG.thumbnails.image.fit;
	const imageStreamSharp = await sharp(fileAbsolutePath).withMetadata().resize(compressData);
	await cacheHelper.saveStream(cacheHelper.TYPE.IMAGE, pathItem.path, imageStreamSharp);
	LOG.debug('[Image thumbnail generator] Generated thumbnail for "' + pathItem.path + '".');
}

module.exports.generateThumbnail = generateThumbnail;
