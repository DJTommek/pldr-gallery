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

    http: {
        // domain, where will be redirected after Google login
        // Note: include also :port if different than 80 or 443
        baseUrl: 'gallery.redilap.cz',
        protocol: 'http',
        // port of webserver
        port: 1119,
        login: {
            // cookie name
            name: 'google-login',
            // expiration in miliseconds of user token (after last use)
            validity: 30 * 24 * 60 * 60 * 1000,
            // path to save logged users tokens
            tokensPath: './tokens/'
        }
    },
    compress: {
        enabled: true,
        fit: 'inside',
        width: 1024,
        height: 1024
    },
    google: {
        clientId: '405123468190-3si7ft7n40r00odqukeml3r9e8tncmju.apps.googleusercontent.com',
        secret: 'kpDiIGevRN0TU9h7xrwNrLKl',
        redirectPath: '/login'
    },
    test: {
        password: '4pTvuKygmguBm19z4CjB'
    }
};

CONFIG.extensionsAll = [].concat(
    CONFIG.extensionsImage,
    CONFIG.extensionsVideo,
    CONFIG.extensionsDownload,
);
CONFIG.extensionsRegexAll = new RegExp('\.(' + CONFIG.extensionsAll.join('|') + ')$', 'i');
CONFIG.extensionsRegexExif = new RegExp('\.(' + CONFIG.extensionsExif.join('|') + ')$', 'i');

// remove path and file, wich are running
const runArgs = process.argv.slice(2);

console.log("Start arguments: " + runArgs.join(' '));
if (runArgs[0] === 'help') {
    console.log('Available command line arguments:');
    console.log('path="<some path>" - REQUIRED - Set base path');
    console.log('  Note: special characters like ", ( or ) has to be escaped, eg. \\", \\( or \\)');
    process.exit();
}

// Set base path via commandline
const match = runArgs.join(' ').match(/path="(.+\/)"/);
if (!match) {
    console.error('You have to set start parameter path="<c:/path/>". More in help');
    process.exit();
}
CONFIG.path = match[1];

CONFIG.google.redirectUrl = CONFIG.http.protocol + '://' + CONFIG.http.baseUrl + CONFIG.google.redirectPath;
module.exports = CONFIG;
