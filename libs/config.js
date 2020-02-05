/*
 * Dont update this file, please. If you want to edit something,
 * Use config.local.js file.
 * For more info check out config.local.example.js
 */
const FS = require('fs');

const merge = require('lodash.merge');

let CONFIG = {
    // loading into <img> tag
    extensionsImage: {
        apng: {
            'mediaType': 'image/apng',
        },
        bmp: {
            'mediaType': 'image/bmp',
        },
        gif: {
            'mediaType': 'image/gif',
        },
        ico: {
            'mediaType': 'image/x-icon',
        },
        cur: {
            'mediaType': 'image/x-icon',
        },
        jpg: {
            'mediaType': 'image/jpeg',
            'exif': true,
            'exifBuffer': 65527
        },
        jpeg: {
            'mediaType': 'image/jpeg',
            'exif': true,
            'exifBuffer': 65527
        },
        jfif: {
            'mediaType': 'image/jpeg',
            'exif': true,
            'exifBuffer': 65527
        },
        pjpeg: {
            'mediaType': 'image/jpeg',
            'exif': true,
            'exifBuffer': 65527
        },
        pjp: {
            'mediaType': 'image/jpeg',
            'exif': true,
            'exifBuffer': 65527
        },
        png: {
            'mediaType': 'image/png',
            'exif': true,
            'exifBuffer': 150000
        },
        svg: {
            'mediaType': 'image/svg+xml',
        },
        webp: {
            'mediaType': 'image/webp',
        },
    },
    // loading into <video> tag
    extensionsVideo: {
        mp4: {
            'mediaType': 'video/mp4',
        },
        webm: {
            'mediaType': 'video/webm',
        },
        ogv: {
            'mediaType': 'video/ogg',
        },
    },
    // loading into <audio> tag
    extensionsAudio: {
        mp3: {
            'mediaType': 'audio/mpeg',
        },
        wav: {
            'mediaType': 'audio/wav',
        },
        ogg: {
            'mediaType': 'audio/ogg',
        },
    },
    // allowing to download
    extensionsDownload: {
        zip: {}, zip64: {}, '7z': {}, rar: {}, gz: {},
        pdf: {}, doc: {}, docx: {}, xls: {}, xlsx: {},
        avi: {}, // video but can't be played in browser
    },
    // showing in structure
    extensionsAll: {}, // generated from other extensions
    extensionsRegexAll: null, // generated from array above
    extensionsRegexExif: null, // generated from array above
    // try to load EXIF data
    extensionsExif: [], // generated automatically
    defaultMediaTypeImage: 'image/png',
    defaultMediaTypeVideo: 'video/mp4',
    defaultMediaTypeAudio: 'audio/mpeg',
    defaultMediaTypeGeneral: 'application/octet-stream',

    compress: {
        enabled: true,
        fit: 'inside',
        width: 1024,
        height: 1024,
        withoutEnlargement: true
    },

    /**
     * Following values are mostly just placeholders, dont forget to set them in config.local.js
     */
    // path to folders and files, where you want to set "root". Can be dynamic or absolute.
    // Use only forward slashesh, even Windows
    // Windows absolute: c:/photos/
    // UNIX absolute: /photos/
    // Relative: ./photos/
    path: '',
    google: {
        // Generate your own "OAuth client ID" credentials for Web application on
        // https://console.developers.google.com/apis/credentials
        clientId: '012345678901-0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d.apps.googleusercontent.com',
        secret: 'aBcDeFgHiJkLmNoPqRsTuVwX',
        redirectPath: '/login', // this should't be updated
        // Generate your own "API key" for Google maps
        // https://console.developers.google.com/apis/credentials
        mapApiKey: 'AIzblahblahblahblahblahblahblahblahblah',
    },
    security: {
        // password for emergency killing application via /api/kill?password=<killPassword>
        // Note: if you start Node.js via "https://www.npmjs.com/package/forever" this will work as "restart" instead of kill
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

// load local config and merge values into this config
if (!FS.existsSync('./libs/config.local.js')) {
    console.error('Missing local config file.\nRename "/libs/config.local.example.js" to "/libs/config.local.js" to continue.');
    process.exit();
}
CONFIG = merge(CONFIG, require('./config.local.js'));

// generate list of allowed file extensions
CONFIG.extensionsAll = merge(CONFIG.extensionsAll,
    CONFIG.extensionsImage,
    CONFIG.extensionsVideo,
    CONFIG.extensionsAudio,
    CONFIG.extensionsDownload
);
CONFIG.extensionsRegexAll = new RegExp('\\.(' + Object.keys(CONFIG.extensionsAll).join('|') + ')$', 'i');

// generate list of files, from which are allowed to try load EXIF info
for (const extension in CONFIG.extensionsImage) {
    if (CONFIG.extensionsImage[extension]['exif'] === true) {
        CONFIG.extensionsExif.pushUnique(extension);
    }
}

CONFIG.extensionsRegexExif = new RegExp('\.(' + CONFIG.extensionsExif.join('|') + ')$', 'i');
// create URL to redirect to login with Google
CONFIG.google.redirectUrl = CONFIG.http.protocol + '://' + CONFIG.http.baseUrl + CONFIG.google.redirectPath;

module.exports = CONFIG;
