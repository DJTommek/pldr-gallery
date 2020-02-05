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
    google: {
        // Generate your own "OAuth client ID" credentials for Web application on
        // https://console.developers.google.com/apis/credentials
        clientId: '012345678901-0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d.apps.googleusercontent.com',
        secret: 'aBcDeFgHiJkLmNoPqRsTuVwX',
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
        // Domain, where will be redirected after Google login
        // Note: include also :port if different than 80 or 443
        baseUrl: 'tomas.palider.cz:1117',
        protocol: 'http',
        // port of webserver
        port: 1117,
    },
};
