const c = {
    imageExtensions: ['jpg', 'jpeg', 'png', 'bmp', 'gif'],
    videoExtensions: ['mp4', 'webm', 'ogv'],
    downloadExtensions: [
		'zip', 'zip64', '7z', 'rar', 'gz',
		'pdf', 'doc', 'docx', 'xls', 'xlsx',
		'mp3', // @TODO - move to audioExtensions
        'avi' // video but can't be played in browser
	],
    http: {
        baseUrl: 'gallery.redilap.cz', // add port if changed or is not redirected to default ports 80 or 443
        protocol: 'http',
        port: 1117,
        login: {
            // Jméno cookie
            name: 'google-login',
            // Jak dlouho po posledním použití bude cookie ještě platná
            validity: 30 * 24 * 60 * 60 * 1000,
            // Kde se budou ukládat textové tokeny
            tokensPath: './tokens/'
        }
    },
    compress: {
        enabled: true,
        minLimit: 1024 * 1024,
        pngQuality: '65-80',
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
c.path = match[1];

c.google.redirectUrl = c.http.protocol + '://' + c.http.baseUrl + c.google.redirectPath;
module.exports = c;
