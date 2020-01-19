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
    /**
     * Following values are just placeholders, dont forget to set them in config.local.js
     */
    path: '',
    google: {
        // Generate your own "OAuth client ID" credentials for Web application on
        // https://console.developers.google.com/apis/credentials
        clientId: '012345678901-0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d.apps.googleusercontent.com',
        secret: 'aBcDeFgHiJkLmNoPqRsTuVwX',
        redirectPath: '/login',
        // Generate your own "API key" for Google maps
        // https://console.developers.google.com/apis/credentials
        mapApiKey: 'AIzblahblahblahblahblahblahblahblahblah',
    },
    security: {
        killPassword: '4pTvuKygmguBm19z4CjB'
    },
    http: {
        // domain, where will be redirected after Google login
        // Note: include also :port if different than 80 or 443
        baseUrl: 'tomas.palider.cz',
        protocol: 'https',
        // port of webserver
        port: 443,
        // maximum time reserverd for one request (in miliseconds)
        timeout: 30 * 1000,
        login: {
            // cookie name
            name: 'google-login',
            // expiration in miliseconds of user token (after last use)
            validity: 30 * 24 * 60 * 60 * 1000,
            // path to save logged users tokens
            tokensPath: './tokens/'
        },
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
