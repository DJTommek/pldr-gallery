const merge = require('lodash.merge');

let CONFIG = {
    // showing in structure
    extensionsAll: [], // generated from other extensions
    // loading into <img> tag
    extensionsImage: ['jpg', 'jpeg', 'png', 'bmp', 'gif'],
    // try to load EXIF data
    extensionsExif: ['jpg', 'jpeg', 'png'],
    // loading into <video> tag
    extensionsVideo: ['mp4', 'webm', 'ogv'],
    // allowing to download
    extensionsDownload: [
		'zip', 'zip64', '7z', 'rar', 'gz',
		'pdf', 'doc', 'docx', 'xls', 'xlsx',
		'mp3', // @TODO - move to audioExtensions
        'avi' // video but can't be played in browser
	],
    extensionsRegexAll: null, // generated from array above
    extensionsRegexExif: null, // generated from array above

    // how big in bytes should be buffer for loading EXIF from file
    // @TODO use multiple buffer sizes depending on file type?
    // https://ftp-osl.osuosl.org/pub/libpng/documents/pngext-1.5.0.html#C.eXIf
    // jpeg: 2^16-9 (65 527) bytes = 65.53 KB
    // png: 2^31-1 (2 147 483 647) bytes  = 2.15 GB
    exifBufferSize: 150000, // 150000 default

    compress: {
        enabled: true,
        fit: 'inside',
        width: 1024,
        height: 1024
    },
};

// load local config
CONFIG = merge(CONFIG, require('./config.local.js'));

CONFIG.extensionsAll = [].concat(
    CONFIG.extensionsImage,
    CONFIG.extensionsVideo,
    CONFIG.extensionsDownload,
);
CONFIG.extensionsRegexAll = new RegExp('\.(' + CONFIG.extensionsAll.join('|') + ')$', 'i');
CONFIG.extensionsRegexExif = new RegExp('\.(' + CONFIG.extensionsExif.join('|') + ')$', 'i');

CONFIG.google.redirectUrl = CONFIG.http.protocol + '://' + CONFIG.http.baseUrl + CONFIG.google.redirectPath;
module.exports = CONFIG;
