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
		const rowsStream = structureRepository.all().stream();
		for await (const row of rowsStream) {
			const pathItem = structureRepository.rowToItem(row);
			try {
				if (CONFIG.structure.scan.itemCooldown) { // Wait before processing each item
					await new Promise(resolve => setTimeout(resolve, CONFIG.structure.scan.itemCooldown));
				}
				const result = await generateThumbnail(pathItem)
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
	if (shouldBeIgnored(pathItem)) {
		return null;
	}

	const cacheItemType = cacheHelper.getTypeFromItem(pathItem)
	if (cacheItemType === null || cacheHelper.exists(cacheItemType, pathItem.path)) {
		return null; // Thumbnail should not be generated or already exists
	}

	const generatingStart = process.hrtime();
	let result = null;

	if (pathItem.isImage) {
		LOG.debug('[Thumbnail generator] Generating thumbnail for "' + pathItem.path + '"...');
		result = await generateImageThumbnail(pathItem);
	} else if (pathItem.isVideo) {
		LOG.debug('[Thumbnail generator] Generating thumbnail for "' + pathItem.path + '"...');
		result = await generateVideoThumbnail(pathItem);
	} else if (pathItem.isFolder) {
		LOG.debug('[Thumbnail generator] Generating thumbnail for "' + pathItem.path + '"...');
		result = await generateDirectoryThumbnail(pathItem);
	}

	if (result === null) {
		return null;
	}

	let generatingDoneTime = msToHuman(hrtime(process.hrtime(generatingStart)));
	// Validate that thumbnail was really generated
	const cacheFilePath = cacheHelper.getPath(cacheHelper.getTypeFromItem(pathItem), pathItem.path, true);
	let thumbnailFileStats;
	const message = 'Generating thumbnail for "' + pathItem.path + '" was finished in ' + generatingDoneTime;

	try {
		thumbnailFileStats = FS.statSync(cacheFilePath);
	} catch (error) {
		throw new Error(message + ' but error occured while thumbnail file check: "' + error.message + '"');
	}

	if (thumbnailFileStats.size < 128) { // Minimum size in bytes
		throw new Error(message + ' but thumbnail size ' + formatBytes(thumbnailFileStats.size) + ' is too small.');
	}

	LOG.debug('[Thumbnail generator] ' + message + '.');

	return result;
}

/**
 * @param {FileItem} fileItem
 * @return {Promise<boolean>}
 */
async function generateImageThumbnail(fileItem) {
	const fileAbsolutePath = pathCustom.relativeToAbsolute(fileItem.path, CONFIG.path);
	let compressData = Object.assign({}, CONFIG.compress);
	compressData.width = CONFIG.thumbnails.width;
	compressData.height = CONFIG.thumbnails.height;
	compressData.fit = CONFIG.thumbnails.image.fit;
	const imageStreamSharp = await sharp(fileAbsolutePath).withMetadata().resize(compressData);
	await cacheHelper.saveStream(cacheHelper.TYPE.IMAGE, fileItem.path, imageStreamSharp);
	return true;
}

/**
 * @param {FileItem} fileItem
 * @return {Promise<boolean>}
 */
async function generateVideoThumbnail(fileItem) {
	LOG.debug('[Thumbnail generator] Generating thumbnail for video "' + fileItem.path + '"...');

	const cacheFilePath = cacheHelper.getPath(cacheHelper.TYPE.VIDEO, fileItem.path, false);
	const cacheFileDir = path.dirname(cacheFilePath)
	const fileAbsolutePath = pathCustom.relativeToAbsolute(fileItem.path, CONFIG.path);

	FS.mkdirSync(cacheFileDir, {recursive: true});

	const errorPrefix = '[Thumbnail generator] Unable to generate thumbnail for video "' + fileItem.path + '": ';

	return await new Promise(function (resolve, reject) {
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
}

/**
 * Generate thumbnail for directory by loading random files anywhere in that directory and composite them together in
 * one image.
 *
 * @param {FolderItem} directoryItem
 * @return {Promise<boolean>}
 */
async function generateDirectoryThumbnail(directoryItem) {

	// Get random X images and generate promises for final composing
	const requiredFilesCount = CONFIG.thumbnails.folder.positions.length;
	const randomFiles = await structureRepository.randomFiles2(directoryItem.path, {count: requiredFilesCount, onlyImages: true});
	if (randomFiles.length !== requiredFilesCount) {
		return null; // Not enough images
	}

	let resizePromises = [];
	randomFiles.forEach(function (fileItem, index) {
		const fileAbsolutePath = pathCustom.relativeToAbsolute(fileItem.path, CONFIG.path);
		const sharpPromise = sharp(fileAbsolutePath).resize({
			width: CONFIG.thumbnails.folder.positions[index].width,
			height: CONFIG.thumbnails.folder.positions[index].height,
		}).toBuffer();
		resizePromises.push(sharpPromise);
	});

	// Resize all loaded images and use them to build final thumbnail
	return await Promise.all(resizePromises).then(async function (resizedImages) {
		const toComposite = [];
		resizedImages.forEach(function (resizedImage, index) {
			toComposite.push({input: resizedImages[index], gravity: CONFIG.thumbnails.folder.positions[index].gravity})
		});
		const thumbnailImageStream = sharp(CONFIG.thumbnails.folder.inputOptions)
			.toFormat(CONFIG.thumbnails.extension)
			.composite(toComposite);

		await cacheHelper.saveStream(cacheHelper.TYPE.FOLDER, directoryItem.path, thumbnailImageStream);
		return true;
	});
}

function shouldBeIgnored(pathItem) {
	let ignorePaths = [];
	if (pathItem.isImage) {
		ignorePaths = CONFIG.thumbnails.image.ignore;
	} else if (pathItem.isVideo) {
		ignorePaths = CONFIG.thumbnails.video.ignore;
	} else if (pathItem.isFolder) {
		ignorePaths = CONFIG.thumbnails.folder.ignore;
	}

	for (const ignorePath of ignorePaths) {
		if (pathItem.path.startsWith(ignorePath)) {
			return true;
		}
	}
	return false;
}
