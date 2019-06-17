module.exports = {
//    path: 'p:/Photo/',
//    path: 'p:/____Family/',
    path: 'd:/Data/Photo/',
    imageExtensions: ['jpg', 'jpeg', 'png', 'bmp'],
    httpServerPort: 1117,
    compress: {
        enabled: true,
        minLimit: 1024 * 1024,
        pngQuality: '65-80',
    },
    google: {
        clientId: '405123468190-3si7ft7n40r00odqukeml3r9e8tncmju.apps.googleusercontent.com',
        secret: 'kpDiIGevRN0TU9h7xrwNrLKl',
//        redirectUrl: 'http://redilap.cz:1117/login'
        redirectUrl: 'http://gallery.redilap.cz/login'
    },
    perms: {
        'x': [
         'demo',
        ],
    }
}
