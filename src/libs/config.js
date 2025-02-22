/*
 * Dont update this file, please. If you want to edit something,
 * Use config.local.js file.
 * For more info check out config.local.example.js
 */
const FS = require('fs');
const PATH = require('path');
const pathCustom = require('./path.js');

const merge = require('lodash.merge');

function errorExit(message) {
	console.error('\x1b[31m' + message + '\x1b[0m');
	process.exit();
}

let CONFIG = {
	/**
	 * Default settings, how should be images compressed (resized)
	 * Set "enabled: false" if you want to disable compressing entirely - all images will be streamed in full size,
	 * even thumbnails which is less load to server to process but more data will be transfered over network
	 *
	 * @See https://sharp.pixelplumbing.com/api-resize
	 */
	compress: {
		enabled: true,
		fit: 'inside',
		width: 1024,
		height: 1024,
		withoutEnlargement: true
	},

	cache: {
		path: __dirname + '/../../temp/',
	},

	/**
	 * Allow users to upload files directly using PldrGallery website.
	 */
	upload: {
		enabled: false,
		/**
		 * Path, where all files will be temporary uploaded until:
		 * - moved into `pathFinal`
		 * - deleted if something is wrong
		 *
		 * PldrGallery must be able to write into this directory.
		 * This path should not be accessible for the public.
		 */
		pathTemp: __dirname + '/../../temp/upload/',
		/**
		 * Path, where all uploaded files will be moved after all validations and checks are successfull. If user
		 * uploaded file to some directory, for example `/demo/files`, then in pathFinal will be created these
		 * directories and file will be put there.
		 *
		 * It is possible to set the same path as main PldrGallery path, so files then can be viewed directly in
		 * PldrGallery instead of manually moving them there. This is recommended only if you trust users/passwords with
		 * write permission.
		 */
		pathFinal: __dirname + '/../../data/upload/',
		allowedExtensions: ['png', 'jpg', 'jpeg', 'heic', 'mp4'], // Must be lowercased
		fileMaxSize: 50 * 1024 * 1024, // Size in bytes, default 50 MB
		fileNameMaxLength: 100, // count of characters (multi-byte character might be counted as more than one character)
	},

	/**
	 * Thumbnails are very small compressed images of real files or directories, that are visible in structure (some
	 * types of view), in map as markers, etc.
	 * Thumbnails must be pre-generated. If user tries to load some thumbnail, that is not yet pre-generated or
	 * thumbnails for this type of file or directory is disabled, it will not be shown.
	 * Thumbnail pre-generator will automatically skip files and folders, if thubmnail already exists.
	 */
	thumbnails: {
		width: 200,
		height: 200,
		// When thumbnail pregenerator should start. At least one of file types or directory must be enabled too.
		pregenerate: {
			onStart: false, // Start generating thumbnails on server start.
			cron: null, // Setup CRON to automatically generate thumbnail for new files and directories, see example:
			// cron: '0 0 4 * * *', // at 04:00:00 AM
		},
		extension: 'jpg', // Used also for mime type, "image/<extension>"
		/**
		 * Resize image and generate thumbnail
		 */
		image: {
			enabled: true,
			// If image path begins with string inside this list, thumbnail will not be generated. Can be full image
			// path or even some directory. Works recursively
			ignore: [],
			httpHeaders: [
				{name: 'Cache-Control', value: 'public, max-age=31536000'}, // keep generated thumbnail image in user's browser cache
			],
			fit: 'cover',
		},
		/**
		 * Get few random images from folder, merge them together and generate one image as thumbnail
		 */
		folder: {
			enabled: true,
			// If directory path begins with string inside this list, thumbnail will not be generated. Works recursively.
			ignore: [],
			httpHeaders: [
				{name: 'Cache-Control', value: 'public, max-age=31536000'}, // keep generated thumbnail image in user's browser cache
			],
			// Sharp create object (you can input your own image)
			inputOptions: {
				create: {
					width: 200, // should be same width as thumbnails.width
					height: 200, // should be same height as thumbnails.height
					channels: 3,
					background: {r: 255, g: 255, b: 255},
				}
			},
			// How small thumbnails will be composited on generated folder thumbnail
			positions: [
				{width: 100, height: 100, gravity: 'northwest'},
				{width: 100, height: 100, gravity: 'northeast'},
				{width: 100, height: 100, gravity: 'southwest'},
				{width: 100, height: 100, gravity: 'southeast'},
				// For example you can generate only three images like this:
				// {width: 200, height: 100, gravity: 'north'},
				// {width: 100, height: 100, gravity: 'southwest'},
				// {width: 100, height: 100, gravity: 'southeast'},
				// Or get only one image with visible background around edges
				// {width: 180, height: 180},
				// For details about gravity look into Sharp API Composite (https://sharp.pixelplumbing.com/api-composite)
			],
		},
		/**
		 * Generate thumbnail image from video
		 * All generated thumbnail are saved into server cache - currently there is no way how to disable it via config.
		 */
		video: {
			enabled: true,
			// If image path begins with string inside this list, thumbnail will not be generated. Can be full image
			// path or even some directory. Works recursively
			ignore: [],
			httpHeaders: [
				{name: 'Cache-Control', value: 'public, max-age=31536000'}, // keep generated thumbnail image in user's browser cache
			],
		},
	},

	/**
	 * Recursively crawl whole files and folders structure and save data to database.
	 */
	structure: {
		scan: {
			depth: 20,
			// To prevent 100% allocating system resources while scanning, wait a while before processing another item.
			// Otherwise it would block other processes as responding to API requests which would lead to users waiting
			// for responses for long time, maybe event until scan is completed. You might need to test it a little bit
			// by running both fast and deep scans so dont hesitate to adjust this value.
			// If your server is very fast (especially disk read speed), you can disable it by setting it to 0.
			itemCooldown: 1, // in milliseconds
			fast: { // Fast scan updates only file and folder structure, without loading any metadata
				onStart: true,
				// Interval should be higher, than how long it takes to run quick scan. Example example:
				// cron: '0 0 * * * *', // every hour
				cron: null,
			},
			deep: { // Deep scan updates file and folder structure including file metadata and EXIF, which is significantly slower
				onStart: false, // if fast.onStart is enabled, deepscan will run once fastscan is completed
				// Interval should be higher, than how long it takes to run quick scan.
				// Should be planned to start, when fastscan is not running.
				// cron: '0 0 4 * * *', // every day at 04:00:00
				cron: null,
			},
			ignoreDirectories: [] // List of directories, that will be ignored from scanning, example:
			// ignoreDir: ['/foo/bar/private/', '/.stversion/'],
		},
		// Watch files and folders and update structure in database automatically as soon as something change.
		// No need to wait for full structure scan. Not available for all servers or some servers might have too low
		// limit for number of watched files (fs.inotify.max_user_watches).
		// Check https://github.com/paulmillr/chokidar for more info.
		watch: {
			enable: false,
		}
	},

	/**
	 * Options to Archiver
	 *
	 * @see https://www.archiverjs.com/
	 * @see https://github.com/archiverjs/node-archiver
	 */
	archive: {
		enabled: true,
		// Output format of generated archive
		// @see https://www.archiverjs.com/index.html#formats
		format: 'zip',
		// This object is passed directly to Archiver
		// @see https://www.archiverjs.com/global.html#CoreOptions
		// @see https://www.archiverjs.com/global.html#TransformOptions
		options: {},
	},

	/**
	 * Options to LESS, CSS preprocessor
	 * @see http://lesscss.org/
	 * @see https://github.com/less/less.js
	 */
	less: {
		// Folder with valid LESS files
		sourcePath: __dirname + '/../webserver/private/less/themes/',
		// This object is passed directly to less-middleware
		// @see https://github.com/emberfeather/less.js-middleware#options
		options: {
			dest: __dirname + '/../../temp/webserver/public/',
			once: true,
			debug: false,
		},
	},

	/**
	 * Options to Terser, JS compiler and minifier
	 * @see https://github.com/terser/terser
	 * @see https://terser.org/
	 */
	terser: {
		// List of files, which will be compiled in final file
		filesToCompile: [
			'/src/webserver/private/js/functions.js',
			// classes
			'/src/webserver/private/js/class/Coordinates.js',
			'/src/webserver/private/js/class/MediaPopup.js',
			'/src/webserver/private/js/class/KeyboardMapper.js',
			'/src/webserver/private/js/class/Icon.js',
			'/src/webserver/private/js/class/FileExtensionMapper.js',
			'/src/webserver/private/js/class/Item.js',
			'/src/webserver/private/js/class/Presentation.js',
			'/src/webserver/private/js/class/ServerApi.js',
			'/src/webserver/private/js/class/Structure.js',
			'/src/webserver/private/js/class/AbstractMap.js',
			'/src/webserver/private/js/class/AbstractStructureMap.js',
			'/src/webserver/private/js/class/StructureMap.js',
			'/src/webserver/private/js/class/BrowserMap.js',
			'/src/webserver/private/js/class/UrlManager.js',
			'/src/webserver/private/js/class/VibrateApi.js',
			// modules
			'/src/webserver/private/js/modules/cookie.js',
			'/src/webserver/private/js/modules/settings.js',
			'/src/webserver/private/js/modules/swipe.js',
		],
		destinationPath: __dirname + '/../../temp/webserver/public/js/modules.min.js',
		// This object is passed directly to terser.minify
		// @see https://github.com/terser/terser#api-reference
		options: {
			compress: {
				reduce_vars: true,
			},
			mangle: {},
			output: {
				beautify: false,
			},
			parse: {},
			rename: {},
		},
	},
	stop: {
		// List of events to register as stopping app
		events: ['SIGINT', 'SIGTERM', 'SIGQUIT'],
		// If after a while is stil not closed, force close
		timeout: 5 * 1000,
	},

	/**
	 * Database settings
	 */
	db: {
		/**
		 * Options to Knex
		 *
		 * @see https://github.com/knex/knex
		 * @see http://knexjs.org/#Installation-node
		 */
		knex: {
			client: 'mysql',
			connection: {
				host: '127.0.0.1',
				port: 3306,
				user: 'root',
				password: '',
				database: 'pldrgallery',
			},
			pool: {
				min: 0,
				max: 10,
			},
			useNullAsDefault: true,
		},
		table: {
			permission: 'pldr_gallery_permission',
			user_group: 'pldr_gallery_user_group',
			user: 'pldr_gallery_user',
			group: 'pldr_gallery_group',
			password: 'pldr_gallery_password',
			structure: 'pldr_gallery_structure',
		}
	},

	/**
	 * Following values are mostly just placeholders, dont forget to set them in config.local.js
	 */
	// path to folders and files, where you want to set "root". Can be dynamic or absolute.
	// Use only forward slashesh, even Windows
	// Windows absolute: c:/photos/
	// UNIX absolute: /photos/
	// Relative: ./photos/
	path: './demo/',
	google: {
		// Generate your own "OAuth client ID" credentials for Web application on
		// https://console.developers.google.com/apis/credentials
		clientId: '012345678901-0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d.apps.googleusercontent.com',
		secret: 'aBcDeFgHiJkLmNoPqRsTuVwX',

		// Domain, where will be redirected after Google login
		// Note: include also :port if different than 80 on http or 443 on https
		redirectUrl: 'http://tomas.palider.cz:3000/login',
	},
	http: {
		// port of non-secured webserver
		port: 3000,
		ssl: {
			// if SSL is enabled both HTTP and HTTPS servers are started, but HTTP have 301 redirecting to HTTPS
			enable: false,
			// in Linux you can generate Lets encrypt certificate via https://certbot.eff.org/
			keyPath: '/etc/letsencrypt/live/your-domain.name/privkey.pem',
			certPath: '/etc/letsencrypt/live/your-domain.name/cert.pem',
			port: 3001,
		},
		/**
		 * Define list of trusted proxies. If request is coming from one of defined IP addresses, then IP passed from
		 * the proxy will be used instead of IP of that proxy. IP address is used for example in logging.
		 * This is directly passed to ExpressJS.
		 * Keep this array empty, if port is directly publicly accessible without any proxy.
		 * @see https://expressjs.com/en/guide/behind-proxies.html
		 * @example trustProxy: ['192.168.0.3']
		 */
		trustProxy: [],
		// maximum time reserverd for one request (in miliseconds)
		timeout: 30 * 1000,
		login: {
			// cookie name
			name: 'google-login',
			// expiration in miliseconds of user token (after last use)
			validity: 30 * 24 * 60 * 60 * 1000,
			// path to save logged users tokens
			tokensPath: __dirname + '/../../data/token/',
		},
		publicPath: __dirname + '/../webserver/public/',
		publicPathGenerated: __dirname + '/../../temp/webserver/public/',
		// Express webserver format for shortcut redirecting to /api/password
		apiPasswordShortcut: '/s/:password',
	},
};

// load local config and merge values into this config
const localConfigPath = pathCustom.join(__dirname, '../../data/config.local.js');
if (!FS.existsSync(localConfigPath)) {
	errorExit('ERROR: Missing local config file.\nRename "data/config.local.example.js" to "data/config.local.js" to continue. Full path is "' + localConfigPath + '"');
}
CONFIG = merge(CONFIG, require(localConfigPath));
CONFIG.start = new Date();

/**
 * Validate and normalize some config values
 */
CONFIG.path = pathCustom.join(CONFIG.path);
if (!PATH.isAbsolute(CONFIG.path)) {
	errorExit('ERROR: Path has to be absolute.');
}

module.exports = CONFIG;
