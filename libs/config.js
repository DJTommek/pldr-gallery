var c = {
//    path: 'p:/Photo/',
    path: 'c:/Dropbox/',
//    path: 'p:/____Family/',
//    path: 'd:/Data/Photo/',
    imageExtensions: ['jpg', 'jpeg', 'png', 'bmp'],
    http: {
        baseUrl: 'gallery.redilap.cz', // add port if changed or is not redirected to default ports 80 or 443
        protocol: 'http',
        port: 1117,
        login: {
            // Jméno cookie
            name: 'google-login',
            // Cookie, kam se přesměrovává po přihlášení
            redirect: 'login-redirect',
            // Jak dlouho po posledním použití bude cookie ještě platná
            validity: 14 * 24 * 60 * 60 * 1000,
            // Kde se budou ukládat textové tokeny
            tokensPath: './tokens/'
        }
    },
    httpServerPort: 1117,
    compress: {
        enabled: true,
        minLimit: 1024 * 1024,
        pngQuality: '65-80',
    },
    google: {
        clientId: '405123468190-3si7ft7n40r00odqukeml3r9e8tncmju.apps.googleusercontent.com',
        secret: 'kpDiIGevRN0TU9h7xrwNrLKl'
    },
    perms: {
        'x': [
            '/'
        ],
    }
};

c.google.redirectUrl = c.http.protocol + '://' + c.http.baseUrl + c.google.redirectPath;
module.exports = c;