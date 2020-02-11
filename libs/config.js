/*
 * Dont update this file, please. If you want to edit something,
 * Use config.local.js file.
 * For more info check out config.local.example.js
 */
const FS = require('fs');

const merge = require('lodash.merge');
require('./../public/js/structure');

let CONFIG = {
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
	path: './demo/',
	google: {
		// Generate your own "OAuth client ID" credentials for Web application on
		// https://console.developers.google.com/apis/credentials
		clientId: '012345678901-0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d.apps.googleusercontent.com',
		secret: 'aBcDeFgHiJkLmNoPqRsTuVwX',

		// Domain, where will be redirected after Google login
		// Note: include also :port if different than 80 on http or 443 on https
		redirectUrl: 'http://tomas.palider.cz:3000/login',

		// Generate your own "API key" for Google maps
		// https://console.developers.google.com/apis/credentials
		mapApiKey: 'AIzblahblahblahblahblahblahblahblahblah',
	},
	security: {
		// password for emergency killing application via /api/kill?password=<killPassword>
		// Note: if you start Node.js via "https://www.npmjs.com/package/forever" this will work as "restart" instead of kill
		killPassword: '4pTvuKygmguBm19z4CjB',
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
		// maximum time reserverd for one request (in miliseconds)
		timeout: 30 * 1000,
		login: {
			// cookie name
			name: 'google-login',
			// expiration in miliseconds of user token (after last use)
			validity: 30 * 24 * 60 * 60 * 1000,
			// path to save logged users tokens
			tokensPath: './tokens/',
		},
	},
};

// load local config and merge values into this config
if (!FS.existsSync('./libs/config.local.js')) {
	console.error('Missing local config file.\nRename "/libs/config.local.example.js" to "/libs/config.local.js" to continue.');
	process.exit();
}
CONFIG = merge(CONFIG, require('./config.local.js'));
CONFIG.start = new Date();


module.exports = CONFIG;
