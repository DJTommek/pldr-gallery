const CONFIG = require('../config.js');
const FS = require('fs');
const FSP = require('fs/promises');
const {pipeline} = require('node:stream/promises');
const PATH = require('path');
const Utils = require('../utils/utils.js');
const crypto = require('crypto');
const HttpResponseError = require('../HttpResponseError.js');
const scanStructure = require('../scanStructure.js');

const chunkFilePrefix = 'chunk_';

class UploadManager {
	constructor(uploadId) {
		if (UploadManager.isUploadIdValid(uploadId) === false) {
			throw new HttpResponseError('Upload session ID is not valid.')
		}

		this.uploadId = uploadId;
		this.directory = null;
		this.fileSize = null;
		this.fileName = null;
	}

	/**
	 * @return {string}
	 */
	static generateUploadId() {
		return crypto.randomUUID();
	}

	static isUploadIdValid(uploadId) {
		if (typeof uploadId !== 'string') {
			return false;
		}
		return uploadId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/) !== null;
	}

	async initNewUpload(directory, fileName, fileSize) {
		this.directory = directory;
		this.fileName = fileName;
		this.fileSize = fileSize;

		await this.getFinalFilePath(); // Validate that file does not already exists.

		await FSP.mkdir(this._getUploadIdPath(), {recursive: true});

		const metadata = {
			directory: this.directory,
			fileName: this.fileName,
			fileSize: this.fileSize,
		};
		await FSP.writeFile(this._getMetadataFilePath(), JSON.stringify(metadata));
	}

	async initExistingUpload() {
		let metadataRaw;
		try {
			metadataRaw = await FSP.readFile(this._getMetadataFilePath());
		} catch (error) {
			if (error.code === 'ENOENT') {
				throw new HttpResponseError('Upload session does not exists.', 400);
			} else {
				throw error;
			}
		}

		const metadata = JSON.parse(metadataRaw.toString());
		this.fileName = metadata.fileName;
		this.directory = metadata.directory;
		this.fileSize = metadata.fileSize;

		return this;
	}

	/**
	 * @param {number} chunkOffset
	 * @param {Buffer} buffer
	 * @return {Promise<void>}
	 */
	writeChunk(chunkOffset, buffer) {
		return new Promise(async (resolve, reject) => {
			const filePathTempChunk = PATH.join(this._getUploadIdPath(), chunkFilePrefix + chunkOffset.toString());
			const chunkWriter = FS.createWriteStream(filePathTempChunk, {flags: 'w'});
			chunkWriter.write(buffer, function (error1) {
				chunkWriter.close(function (error2) {
					const error = error1 || error2;
					error ? reject(error) : resolve();
				})
			});
		});
	}

	async getAllChunks() {
		const uploadIdPath = this._getUploadIdPath();
		const files = await FSP.readdir(uploadIdPath, {withFileTypes: true});
		const result = [];
		for (const file of files) {
			if (file.isFile() === false) {
				continue;
			}
			if (file.name.startsWith(chunkFilePrefix) === false) {
				continue;
			}
			const chunkFullPath = PATH.join(file.parentPath || file.path, file.name);
			result.push(chunkFullPath);
		}

		result.sort((a, b) => this.chunkOffsetFromFilePath(a) - this.chunkOffsetFromFilePath(b));
		return result;
	}

	/**
	 * @return {Promise<number>}
	 */
	async getLastChunkOffset() {
		const allChunksPaths = await this.getAllChunks();
		const lastChunkPath = allChunksPaths.pop();
		return this.chunkOffsetFromFilePath(lastChunkPath);
	}


	/**
	 * @param {string} filePath
	 * @return {number}
	 */
	chunkOffsetFromFilePath(filePath) {
		return parseInt(filePath.split(chunkFilePrefix).pop());
	}

	/**
	 * Throws error, if sum of uploaded chunks is greater than defined in upload initialization.
	 */
	async areAllChunksUploaded() {
		let allChunksSize = 0;
		for (let chunkPath of await this.getAllChunks()) {
			allChunksSize += (await FSP.lstat(chunkPath)).size;
		}

		if (allChunksSize > this.fileSize) {
			throw new HttpResponseError('Total size of chunk size ' + allChunksSize + ' is greater than expected file size ' + this.fileSize + '.', 400);
		}

		return allChunksSize === this.fileSize;
	}

	/**
	 * Join all existing chunks into one file and move it to the final location.
	 */
	async completeUpload() {
		const filePathFinal = await this.getFinalFilePath();

		await FSP.mkdir(PATH.dirname(filePathFinal), {recursive: true});
		const filePathFinalStream = FS.createWriteStream(filePathFinal, {flags: 'as', autoClose: false});
		try {
			const allChunks = await this.getAllChunks();
			let chunkCounter = 0;
			for (const chunkFile of allChunks) {
				console.log('Writing chunk ' + (++chunkCounter) + '/' + allChunks.length + ' from "' + chunkFile + '" into "' + filePathFinal + '"');
				await this._writeChunkToFinalFile(filePathFinalStream, chunkFile)
			}
		} catch (error) {
			console.log('catched error in completeUpload', error)
			throw error;
		} finally {
			filePathFinalStream.close();
		}

		return filePathFinal;
	}

	/**
	 * Check if file was successfully uploaded (file exists, file size matches)
	 *
	 * @param {string} finalFilePath Final abstolute path, where uploaded file was moved to.
	 * @return {Promise<void>}
	 */
	async validateCompletedUpload(finalFilePath) {
		const stats = await FSP.stat(finalFilePath); // Checks that file exists and it is accessible
		if (stats.size !== this.fileSize) {
			throw new Error('Saved file size ' + formatBytes(stats.size) + ' does not match with expected size of ' + formatBytes(this.fileSize) + '.');
		}

		if (Utils.pathInPath(CONFIG.path, finalFilePath)) {
			await scanStructure.scanOne(finalFilePath, stats, {exif: true, save: true});
		}
	}

	/**
	 * Load content of chunk and write it into provided write stream.
	 *
	 * @param {FS.WriteStream} filePathFinalStream
	 * @param {string} chunkFile Absolute path to the chunk file
	 * @return {Promise<void>}
	 * @private
	 */
	async _writeChunkToFinalFile(filePathFinalStream, chunkFile) {
		const chunkReadStream = FS.createReadStream(chunkFile, {flags: 'rs'});
		try {
			await pipeline(chunkReadStream, filePathFinalStream, {end: false});
		} finally {
			chunkReadStream.close();
		}
	}

	/**
	 * Delete all temporary files related to upload session ID
	 */
	async cleanup() {
		const uploadIdPath = this._getUploadIdPath();
		await FSP.rm(uploadIdPath, {force: true, recursive: true, maxRetries: 5});
	}

	/**
	 * Returns directory, where all chunks will be saved.
	 *
	 * @return {string}
	 */
	_getUploadIdPath() {
		return PATH.join(CONFIG.upload.pathTemp, this.uploadId);
	}

	/**
	 * Returns path to a file, where metadata will be stored.
	 *
	 * @return {string}
	 */
	_getMetadataFilePath() {
		return PATH.join(this._getUploadIdPath(), 'metadata.json');
	}

	/**
	 * Build final path, where file should be uploaded when all chunks are completed.
	 * If file already exists and if uploaded file has the same size as existing file, throws error.
	 * If file has different size, then add suffix _xx to file name and do the check again.
	 * @TODO Duplication check is naive, hash of file would be better but it is more resource and time consuming.
	 */
	async getFinalFilePath() {
		const fileNameExtension = PATH.extname(this.fileName).substring(1).toLowerCase(); // '.ext' -> 'ext'
		const fileNameWithoutExtension = PATH.basename(this.fileName, '.' + fileNameExtension);

		let filePathFinal;
		let existingFileStats;
		let counter = 0;
		let fileNameFinal = this.fileName;
		do {
			if (counter > 0) {
				// Suffix in form of _xx, as it is used in Android when more than one photo is taken in one second.
				fileNameFinal = fileNameWithoutExtension + '_' + counter.toString().padStart(2, '0') + '.' + fileNameExtension
			}
			filePathFinal = PATH.join(CONFIG.upload.pathFinal, this.directory, fileNameFinal);
			existingFileStats = await Utils.fsLstat(filePathFinal);
			if (existingFileStats?.size === this.fileSize) {
				throw new HttpResponseError('File already exists.', 400);
			}
			counter++;
		} while (existingFileStats !== null);
		return filePathFinal;
	}
}

module.exports = UploadManager
