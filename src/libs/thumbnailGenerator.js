const CONFIG = require('./config.js');
const LOG = require('./log.js');
const pathCustom = require('./path.js');
const structureRepository = require('./repository/structure.js');
const cacheHelper = require("../webserver/pages/api/helpers/cache");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const path = require("path");
const FS = require("fs");

let generatorRunning = false;

async function generateAllThumbnails() {
	let counter = 0;

	if (generatorRunning === true) {
		LOG.info('[Thumbnail generator] Already running...');
		return;
	}
	generatorRunning = true;
	LOG.info('[Thumbnail generator] Starting generating thumbnails...');
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
		LOG.info('[Thumbnail generator] Generated ' + counter + ' thumbnails in ' + generatingDoneTime + '.');
		generatorRunning = false;
	}
}

module.exports.generateThumbnails = generateAllThumbnails;

/**
 * @param {FileItem|FolderItem} pathItem
 * @return {Promise<true|null>} Returns true if thumbnail already exists or it was just generated and saved
 */
async function generateThumbnail(pathItem) {
	if (pathItem.isImage) {
		return await generateImageThumbnail(pathItem);
	} else if (pathItem.isVideo) {
		return await generateVideoThumbnail(pathItem);
	}

	return null;
}

module.exports.generateThumbnail = generateThumbnail;

/**
 * @param {FileItem} fileItem
 * @return {Promise<boolean>}
 */
async function generateImageThumbnail(fileItem) {
	const cacheFilePath = cacheHelper.getPath(cacheHelper.TYPE.IMAGE, fileItem.path, true);
	if (cacheFilePath !== null) {
		return null; // Thumbnail already exists
	}

	LOG.debug('[Thumbnail generator] Generating thumbnail for image "' + fileItem.path + '"...');
	const generatingStart = process.hrtime();
	const fileAbsolutePath = pathCustom.relativeToAbsolute(fileItem.path, CONFIG.path);
	let compressData = Object.assign({}, CONFIG.compress);
	compressData.width = CONFIG.thumbnails.width;
	compressData.height = CONFIG.thumbnails.height;
	compressData.fit = CONFIG.thumbnails.image.fit;
	const imageStreamSharp = await sharp(fileAbsolutePath).withMetadata().resize(compressData);
	await cacheHelper.saveStream(cacheHelper.TYPE.IMAGE, fileItem.path, imageStreamSharp);
	let generatingDoneTime = msToHuman(hrtime(process.hrtime(generatingStart)));
	LOG.debug('[Thumbnail generator] Generated thumbnail for image "' + fileItem.path + '" in ' + generatingDoneTime + '.');
	return true;
}

/**
 * @param {FileItem} fileItem
 * @return {Promise<boolean>}
 */
async function generateVideoThumbnail(fileItem) {
	const cacheFilePath = cacheHelper.getPath(cacheHelper.TYPE.VIDEO, fileItem.path, false);
	if (FS.existsSync(cacheFilePath) === true) {
		return null; // Thumbnail already exists
	}

	LOG.debug('[Thumbnail generator] Generating thumbnail for video "' + fileItem.path + '"...');
	const generatingStart = process.hrtime();
	const fileAbsolutePath = pathCustom.relativeToAbsolute(fileItem.path, CONFIG.path);

	const cacheFileDir = path.dirname(cacheFilePath)
	FS.mkdirSync(cacheFileDir, {recursive: true});

	const errorPrefix = '[Thumbnail generator] Unable to generate thumbnail for video "' + fileItem.path + '": ';

	const ffmpegResult = await new Promise(function (resolve, reject) {
		ffmpeg(fileAbsolutePath)
			.screenshots({
				count: 1, // 1 = thumbnail from middle of video
				folder: cacheFileDir,
				filename: path.basename(cacheFilePath),
				size: CONFIG.thumbnails.width + 'x' + CONFIG.thumbnails.height,
			})
			.autopad()
			.on('error', function (error) {
				if (error.message.includes('moov atom not found')) {
					LOG.warning(errorPrefix + '"moov atom not found". File seems to be corrupted, is it still playable?');
				} else {
					LOG.error(errorPrefix + error);
				}
				reject(error);
			})
			.on('end', function () {
				resolve(true);
			});
	});

	let generatingDoneTime = msToHuman(hrtime(process.hrtime(generatingStart)));

	// Check that thumbnail was really generated
	let thumbnailFileStats;
	try {
		thumbnailFileStats = FS.statSync(cacheFilePath);
	} catch (error) {
		throw new Error('[Thumbnail generator] Generating thumbnail for video "' + fileItem.path + '" was finished in ' + generatingDoneTime + ' but error occured while thumbnail file check: "' + error.message + '"');
	}

	if (thumbnailFileStats.size < 128) { // Minimum size in bytes
		throw new Error('[Thumbnail generator] Generating thumbnail for video "' + fileItem.path + '" was finished in ' + generatingDoneTime + ' but thumbnail size ' + formatBytes(thumbnailFileStats.size) + ' is too small.');
	}

	LOG.debug('[Thumbnail generator] Generated thumbnail for video "' + fileItem.path + '" in ' + generatingDoneTime + '.');
	return ffmpegResult;
}

