/**
 * Example file for config.local.js
 * Rename this file to config.local.js and it will override variables in config.js
 *
 * Feel free to edit anything just make sure that you know, what are you doing.
 * In this example all variables SHOULD be updated.
 */
module.exports = {
	// path to folders and files, where you want to set "root". Can be dynamic or absolute.
	// Use only forward slashesh, even Windows
	// Windows absolute: c:/photos/
	// UNIX absolute: /photos/
	// Relative: ./photos/
	path: './demo/',

	thumbnails: {
		image: {
			// false: generate thumbnails on every request (save space on drive)
			// true: generate thumbnail on first request and save it. On every other request it will be loaded from cache (faster and saving server performance)
			cache: false,
		},
		folder: {
			cache: false, // the same as thumbnails.image.cache
		}
	},

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
		// password for emergency killing application via /api/kill?password=someSecureKillPassword
		// Note: if you start Node.js via https://www.npmjs.com/package/forever this will work as "restart" instead of kill (useful if debugging or updating to new version)
		// killPassword: 'someSecureKillPassword', // enabled
		// killPassword: null, // disabled
		killPassword: null,
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