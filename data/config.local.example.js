/**
 * Feel free to edit anything just make sure that you know, what are you doing.
 */
module.exports = {
	// Path to folders and files, where you want to set "root".
	// To prevent possible issues:
	// - has to be absolute (use __dirname to get relative path to this file)
	// - should use only forward slashes (backward slashes will be automatically replaced)
	// path: __dirname + '/../demo/',
	// path: /some/absolute/path/
	path: __dirname + '/../demo/',

	db: {
		// Database for saving permissions, file and folder structure and more
		knex: {
			connection: {
				host: '127.0.0.1',
				user: 'pldrgallery',
				password: '',
				database: 'pldrgallery',
			},
		},
	},

	structure: {
		scan: {
			fast: { // Fast scan updates only file and folder structure, without loading any metadata
				onStart: true,
			},
			deep: { // Deep scan updates file and folder structure including file metadata and EXIF, which is significantly slower
				onStart: false, // if fast.onStart is enabled, deepscan will run once fastscan is completed
			},
			ignoreDirectories: [], // List of directories, that will be ignored from scanning, example:
			// ignoreDir: ['/foo/bar/private/', '/.stversion/'],
		},
	},

	/**
	 * Thumbnails are very small compressed images of real files or directories, that are visible in structure (some
	 * types of view), in map as markers, etc.
	 * Thumbnails must be pre-generated. If user tries to load some thumbnail, that is not yet pre-generated or
	 * thumbnails for this type of file or directory is disabled, it will not be shown.
	 * Thumbnail pre-generator will automatically skip files and folders, if thubmnail already exists.
	 */
	thumbnails: {
		// When thumbnail pregenerator should start. At least one of file types or directory must be enabled too.
		pregenerate: {
			onStart: false, // Start generating thumbnails on server start.
			cron: null, // Setup CRON to automatically generate thumbnail for new files and directories, see example:
			// cron: '0 0 4 * * *', // at 04:00:00 AM
		},
		/**
		 * Resize image and generate thumbnail.
		 */
		image: {
			enabled: false,
		},
		/**
		 * Get few random images from folder, merge them together and generate one image as thumbnail
		 */
		folder: {
			enabled: false,
		},
		/**
		 * Generate thumbnail image from video
		 * All generated thumbnail are saved into server cache - currently there is no way how to disable it via config.
		 */
		video: {
			enabled: false,
		},
	},

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
	},
};
