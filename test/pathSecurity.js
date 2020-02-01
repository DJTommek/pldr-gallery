require('../public/js/functions.js');
const assert = require('assert');
const perms = require('../libs/permissions.js');
const HFS = require('../libs/helperFilesystem.js');

describe('Handle requested path', function() {
    const ERROR_BACKSLASH = 'Backslash is not allowed';
    const ERROR_DYNAMIC = 'Dynamic path is not allowed';
    const ERROR_QUERY = 'Query path has to start with forward slash';
    const ERROR_ASTERISK = 'Asterisk is not allowed';
    const ERROR_QUESTIONMARK = 'Questionmark is not allowed';

    it('Dynamic path and root permission', function() {
        const basePath = './demo/';
        const userPerms = ['/'];

        const requestedPaths = [
            {path: '/', output: {fullPathFolder: './demo/', path: '/', queryPath: '/'}},
            /*
             * check for errors ("queryPath" is always the same as "path")
             */

            // backslash
            {path: '\\', output: {error: ERROR_BACKSLASH, queryPath: '\\'}},
            {path: 'some path\\', output: {error: ERROR_BACKSLASH, queryPath: 'some path\\'}},
            {path: '/some path\\', output: {error: ERROR_BACKSLASH, queryPath: '/some path\\'}},
            {path: '%5C', output: {error: ERROR_BACKSLASH, queryPath: '\\'}},
            {path: '*\\', output: {error: ERROR_BACKSLASH, queryPath: '*\\'}},
            {path: '/some/long/path\\back/', output: {error: ERROR_BACKSLASH, queryPath: '/some/long/path\\back/'}},

            // has to start with "/"
            {path: '*', output: {error: ERROR_QUERY, queryPath: '*'}},
            {path: '%2A', output: {error: ERROR_QUERY, queryPath: '*'}},
            {path: '?', output: {error: ERROR_QUERY, queryPath: '?'}},
            {path: '%3F', output: {error: ERROR_QUERY, queryPath: '?'}},
            {path: './some-path/../', output: {error: ERROR_QUERY, queryPath: './some-path/../'}},
            {path: 'demo', output: {error: ERROR_QUERY, queryPath: 'demo'}},

            // asterisk
            {path: '/*/', output: {error: ERROR_ASTERISK, queryPath: '/*/'}},
            {path: '/demo/*/', output: {error: ERROR_ASTERISK, queryPath: '/demo/*/'}},
            {path: '/%2A/', output: {error: ERROR_ASTERISK, queryPath: '/*/'}},

            // questionmark
            {path: '/?/', output: {error: ERROR_QUESTIONMARK, queryPath: '/?/'}},
            {path: '/some-path/?/', output: {error: ERROR_QUESTIONMARK, queryPath: '/some-path/?/'}},
            {path: '/blah path?', output: {error: ERROR_QUESTIONMARK, queryPath: '/blah path?'}},
            {path: '/%3F/', output: {error: ERROR_QUESTIONMARK, queryPath: '/?/'}},

            // Dynamic path
            {path: '/../', output: {error: ERROR_DYNAMIC, queryPath: '/../'}},
            {path: '/./', output: {error: ERROR_DYNAMIC, queryPath: '/./'}},
            {path: '/some-path/../', output: {error: ERROR_DYNAMIC, queryPath: '/some-path/../'}},
            {path: '/../some-path/', output: {error: ERROR_DYNAMIC, queryPath: '/../some-path/'}},
            {path: '/../some-path/../', output: {error: ERROR_DYNAMIC, queryPath: '/../some-path/../'}},

            // file missing
            {path: '/non-exist-file.png', output: {error: 'Cant load "/non-exist-file.png", error: ENOENT: no such file or directory, lstat \'./demo/non-exist-file.png\'', queryPath: '/non-exist-file.png'}},

            // folder missing
            {path: '/non-exist-folder/', output: {error: 'Cant load "/non-exist-folder/", error: ENOENT: no such file or directory, lstat \'./demo/non-exist-folder/\'', queryPath: '/non-exist-folder/'}},

            // requested file but it is folder
            {path: '/permissions', output: {error: 'Requested path "/permissions" is not file', queryPath: '/permissions'}},

            // requested folder but it is file
            {path: '/permissions/secured-image-1.jpg/', output: {error: 'Requested path "/permissions/secured-image-1.jpg/" is not folder', queryPath: '/permissions/secured-image-1.jpg/'}},

            /*
             * Valid requests
             */

            // valid folders
            {path: '/', output: {fullPathFolder: './demo/', path: '/', queryPath: '/'}},
            {path: '/permissions/', output: {fullPathFolder: './demo/permissions/', path: '/permissions/', queryPath: '/permissions/'}},
            {path: '/special-characters/', output: {fullPathFolder: './demo/special-characters/', path: '/special-characters/', queryPath: '/special-characters/'}},
            {path: '/special-characters/اللغة العربية‎‎/', output: {fullPathFolder: './demo/special-characters/اللغة العربية‎‎/', path: '/special-characters/اللغة العربية‎‎/', queryPath: '/special-characters/اللغة العربية‎‎/'}},
            {path: '/special-characters/arabian-اللغة العربية‎‎/', output: {fullPathFolder: './demo/special-characters/arabian-اللغة العربية‎‎/', path: '/special-characters/arabian-اللغة العربية‎‎/', queryPath: '/special-characters/arabian-اللغة العربية‎‎/'}},
            {path: '/special-characters/pangram - J.Q. Vandz struck my big fox whelp/', output: {fullPathFolder: './demo/special-characters/pangram - J.Q. Vandz struck my big fox whelp/', path: '/special-characters/pangram - J.Q. Vandz struck my big fox whelp/', queryPath: '/special-characters/pangram - J.Q. Vandz struck my big fox whelp/'}},
            {path: '/special-characters/pangram - Kŕdeľ šťastných ďatľov učí pri ústí Váhu mĺkveho koňa obhrýzať kôru a žrať čerstvé mäso/', output: {fullPathFolder: './demo/special-characters/pangram - Kŕdeľ šťastných ďatľov učí pri ústí Váhu mĺkveho koňa obhrýzať kôru a žrať čerstvé mäso/', path: '/special-characters/pangram - Kŕdeľ šťastných ďatľov učí pri ústí Váhu mĺkveho koňa obhrýzať kôru a žrať čerstvé mäso/', queryPath: '/special-characters/pangram - Kŕdeľ šťastných ďatľov učí pri ústí Váhu mĺkveho koňa obhrýzať kôru a žrať čerstvé mäso/'}},
            {path: '/special-characters/pangram - Nechť již hříšné saxofony ďáblů rozezvučí síň úděsnými tóny waltzu, tanga a quickstepu/', output: {fullPathFolder: './demo/special-characters/pangram - Nechť již hříšné saxofony ďáblů rozezvučí síň úděsnými tóny waltzu, tanga a quickstepu/', path: '/special-characters/pangram - Nechť již hříšné saxofony ďáblů rozezvučí síň úděsnými tóny waltzu, tanga a quickstepu/', queryPath: '/special-characters/pangram - Nechť již hříšné saxofony ďáblů rozezvučí síň úděsnými tóny waltzu, tanga a quickstepu/'}},
            {path: '/special-characters/pangram - Portez ce vieux whisky au juge blond qui fume!/', output: {fullPathFolder: './demo/special-characters/pangram - Portez ce vieux whisky au juge blond qui fume!/', path: '/special-characters/pangram - Portez ce vieux whisky au juge blond qui fume!/', queryPath: '/special-characters/pangram - Portez ce vieux whisky au juge blond qui fume!/'}},
            {path: '/special-characters/pangram - příliš žluťoučký kůň úpěl ďábelské ódy/', output: {fullPathFolder: './demo/special-characters/pangram - příliš žluťoučký kůň úpěl ďábelské ódy/', path: '/special-characters/pangram - příliš žluťoučký kůň úpěl ďábelské ódy/', queryPath: '/special-characters/pangram - příliš žluťoučký kůň úpěl ďábelské ódy/'}},
            {path: '/special-characters/pangram - The quick brown fox jumps over a lazy dog/', output: {fullPathFolder: './demo/special-characters/pangram - The quick brown fox jumps over a lazy dog/', path: '/special-characters/pangram - The quick brown fox jumps over a lazy dog/', queryPath: '/special-characters/pangram - The quick brown fox jumps over a lazy dog/'}},
            {path: '/special-characters/pangram - Vypätá dcéra grófa Maxwella s IQ nižším ako kôň núti čeľaď hrýzť hŕbu jabĺk/', output: {fullPathFolder: './demo/special-characters/pangram - Vypätá dcéra grófa Maxwella s IQ nižším ako kôň núti čeľaď hrýzť hŕbu jabĺk/', path: '/special-characters/pangram - Vypätá dcéra grófa Maxwella s IQ nižším ako kôň núti čeľaď hrýzť hŕbu jabĺk/', queryPath: '/special-characters/pangram - Vypätá dcéra grófa Maxwella s IQ nižším ako kôň núti čeľaď hrýzť hŕbu jabĺk/'}},
            {path: '/special-characters/pangram - У Іўі худы жвавы чорт у зялёнай камізэльцы пабег пад\'есці фаршу з юшкай/', output: {fullPathFolder: './demo/special-characters/pangram - У Іўі худы жвавы чорт у зялёнай камізэльцы пабег пад\'есці фаршу з юшкай/', path: '/special-characters/pangram - У Іўі худы жвавы чорт у зялёнай камізэльцы пабег пад\'есці фаршу з юшкай/', queryPath: '/special-characters/pangram - У Іўі худы жвавы чорт у зялёнай камізэльцы пабег пад\'есці фаршу з юшкай/'}},

            // valid files
            {path: '/permissions/secured-image-1.jpg', output: {fullPathFile: './demo/permissions/secured-image-1.jpg', path: '/permissions/secured-image-1.jpg', queryPath: '/permissions/secured-image-1.jpg'}},
            {path: '/special-characters/tilde~in name.jpg', output: {fullPathFile: './demo/special-characters/tilde~in name.jpg', path: '/special-characters/tilde~in name.jpg', queryPath: '/special-characters/tilde~in name.jpg'}},
            {path: '/special-characters/plus+sign+is treted as space in frontend.jpg', output: {fullPathFile: './demo/special-characters/plus+sign+is treted as space in frontend.jpg', path: '/special-characters/plus+sign+is treted as space in frontend.jpg', queryPath: '/special-characters/plus+sign+is treted as space in frontend.jpg'}},
            {path: '/special-characters/pangram - דג סקרן שט בים מאוכזב ולפתע מצא לו חברה.jpg', output: {fullPathFile: './demo/special-characters/pangram - דג סקרן שט בים מאוכזב ולפתע מצא לו חברה.jpg', path: '/special-characters/pangram - דג סקרן שט בים מאוכזב ולפתע מצא לו חברה.jpg', queryPath: '/special-characters/pangram - דג סקרן שט בים מאוכזב ולפתע מצא לו חברה.jpg'}},
        ];
        let i = 0;
        for (const data of requestedPaths) {
            let requestedPathBase64 = (new Buffer(data.path)).toString('base64');
            assert.deepStrictEqual(HFS.pathMasterCheck(basePath, requestedPathBase64, userPerms, perms.test), data.output);
            i++;
        }
    });

    it('Absolute path on Windows and root permission', function() {
        const basePath = 'c:/Dropbox/Websites/pldrGallery/git/demo/';
        const userPerms = ['/'];

        const requestedPaths = [
            {path: '/', output: {fullPathFolder: 'c:/Dropbox/Websites/pldrGallery/git/demo/', path: '/', queryPath: '/'}},
            /*
             * check for errors ("queryPath" is always the same as "path")
             */

            // backslash
            {path: '\\', output: {error: ERROR_BACKSLASH, queryPath: '\\'}},
            {path: 'some path\\', output: {error: ERROR_BACKSLASH, queryPath: 'some path\\'}},
            {path: '/some path\\', output: {error: ERROR_BACKSLASH, queryPath: '/some path\\'}},
            {path: '%5C', output: {error: ERROR_BACKSLASH, queryPath: '\\'}},
            {path: '*\\', output: {error: ERROR_BACKSLASH, queryPath: '*\\'}},
            {path: '/some/long/path\\back/', output: {error: ERROR_BACKSLASH, queryPath: '/some/long/path\\back/'}},

            // has to start with "/"
            {path: '*', output: {error: ERROR_QUERY, queryPath: '*'}},
            {path: '%2A', output: {error: ERROR_QUERY, queryPath: '*'}},
            {path: '?', output: {error: ERROR_QUERY, queryPath: '?'}},
            {path: '%3F', output: {error: ERROR_QUERY, queryPath: '?'}},
            {path: './some-path/../', output: {error: ERROR_QUERY, queryPath: './some-path/../'}},
            {path: 'demo', output: {error: ERROR_QUERY, queryPath: 'demo'}},

            // asterisk
            {path: '/*/', output: {error: ERROR_ASTERISK, queryPath: '/*/'}},
            {path: '/demo/*/', output: {error: ERROR_ASTERISK, queryPath: '/demo/*/'}},
            {path: '/%2A/', output: {error: ERROR_ASTERISK, queryPath: '/*/'}},

            // questionmark
            {path: '/?/', output: {error: ERROR_QUESTIONMARK, queryPath: '/?/'}},
            {path: '/some-path/?/', output: {error: ERROR_QUESTIONMARK, queryPath: '/some-path/?/'}},
            {path: '/blah path?', output: {error: ERROR_QUESTIONMARK, queryPath: '/blah path?'}},
            {path: '/%3F/', output: {error: ERROR_QUESTIONMARK, queryPath: '/?/'}},

            // Dynamic path
            {path: '/../', output: {error: ERROR_DYNAMIC, queryPath: '/../'}},
            {path: '/./', output: {error: ERROR_DYNAMIC, queryPath: '/./'}},
            {path: '/some-path/../', output: {error: ERROR_DYNAMIC, queryPath: '/some-path/../'}},
            {path: '/../some-path/', output: {error: ERROR_DYNAMIC, queryPath: '/../some-path/'}},
            {path: '/../some-path/../', output: {error: ERROR_DYNAMIC, queryPath: '/../some-path/../'}},

            // file missing
            {path: '/non-exist-file.png', output: {error: 'Cant load "/non-exist-file.png", error: ENOENT: no such file or directory, lstat \'c:/Dropbox/Websites/pldrGallery/git/demo/non-exist-file.png\'', queryPath: '/non-exist-file.png'}},

            // folder missing
            {path: '/demo/', output: {error: 'Cant load "/demo/", error: ENOENT: no such file or directory, lstat \'c:/Dropbox/Websites/pldrGallery/git/demo/demo/\'', queryPath: '/demo/'}},

            // requested file but it is folder
            {path: '/permissions', output: {error: 'Requested path "/permissions" is not file', queryPath: '/permissions'}},

            // requested folder but it is file
            {path: '/permissions/secured-image-1.jpg/', output: {error: 'Requested path "/permissions/secured-image-1.jpg/" is not folder', queryPath: '/permissions/secured-image-1.jpg/'}},

            /*
             * Valid requests
             */

            // valid folders
            {path: '/', output: {fullPathFolder: 'c:/Dropbox/Websites/pldrGallery/git/demo/', path: '/', queryPath: '/'}},
            {path: '/permissions/', output: {fullPathFolder: 'c:/Dropbox/Websites/pldrGallery/git/demo/permissions/', path: '/permissions/', queryPath: '/permissions/'}},
            {path: '/special-characters/', output: {fullPathFolder: 'c:/Dropbox/Websites/pldrGallery/git/demo/special-characters/', path: '/special-characters/', queryPath: '/special-characters/'}},
            {path: '/special-characters/اللغة العربية‎‎/', output: {fullPathFolder: 'c:/Dropbox/Websites/pldrGallery/git/demo/special-characters/اللغة العربية‎‎/', path: '/special-characters/اللغة العربية‎‎/', queryPath: '/special-characters/اللغة العربية‎‎/'}},
            {path: '/special-characters/arabian-اللغة العربية‎‎/', output: {fullPathFolder: 'c:/Dropbox/Websites/pldrGallery/git/demo/special-characters/arabian-اللغة العربية‎‎/', path: '/special-characters/arabian-اللغة العربية‎‎/', queryPath: '/special-characters/arabian-اللغة العربية‎‎/'}},
            {path: '/special-characters/pangram - J.Q. Vandz struck my big fox whelp/', output: {fullPathFolder: 'c:/Dropbox/Websites/pldrGallery/git/demo/special-characters/pangram - J.Q. Vandz struck my big fox whelp/', path: '/special-characters/pangram - J.Q. Vandz struck my big fox whelp/', queryPath: '/special-characters/pangram - J.Q. Vandz struck my big fox whelp/'}},
            {path: '/special-characters/pangram - Kŕdeľ šťastných ďatľov učí pri ústí Váhu mĺkveho koňa obhrýzať kôru a žrať čerstvé mäso/', output: {fullPathFolder: 'c:/Dropbox/Websites/pldrGallery/git/demo/special-characters/pangram - Kŕdeľ šťastných ďatľov učí pri ústí Váhu mĺkveho koňa obhrýzať kôru a žrať čerstvé mäso/', path: '/special-characters/pangram - Kŕdeľ šťastných ďatľov učí pri ústí Váhu mĺkveho koňa obhrýzať kôru a žrať čerstvé mäso/', queryPath: '/special-characters/pangram - Kŕdeľ šťastných ďatľov učí pri ústí Váhu mĺkveho koňa obhrýzať kôru a žrať čerstvé mäso/'}},
            {path: '/special-characters/pangram - Nechť již hříšné saxofony ďáblů rozezvučí síň úděsnými tóny waltzu, tanga a quickstepu/', output: {fullPathFolder: 'c:/Dropbox/Websites/pldrGallery/git/demo/special-characters/pangram - Nechť již hříšné saxofony ďáblů rozezvučí síň úděsnými tóny waltzu, tanga a quickstepu/', path: '/special-characters/pangram - Nechť již hříšné saxofony ďáblů rozezvučí síň úděsnými tóny waltzu, tanga a quickstepu/', queryPath: '/special-characters/pangram - Nechť již hříšné saxofony ďáblů rozezvučí síň úděsnými tóny waltzu, tanga a quickstepu/'}},
            {path: '/special-characters/pangram - Portez ce vieux whisky au juge blond qui fume!/', output: {fullPathFolder: 'c:/Dropbox/Websites/pldrGallery/git/demo/special-characters/pangram - Portez ce vieux whisky au juge blond qui fume!/', path: '/special-characters/pangram - Portez ce vieux whisky au juge blond qui fume!/', queryPath: '/special-characters/pangram - Portez ce vieux whisky au juge blond qui fume!/'}},
            {path: '/special-characters/pangram - příliš žluťoučký kůň úpěl ďábelské ódy/', output: {fullPathFolder: 'c:/Dropbox/Websites/pldrGallery/git/demo/special-characters/pangram - příliš žluťoučký kůň úpěl ďábelské ódy/', path: '/special-characters/pangram - příliš žluťoučký kůň úpěl ďábelské ódy/', queryPath: '/special-characters/pangram - příliš žluťoučký kůň úpěl ďábelské ódy/'}},
            {path: '/special-characters/pangram - The quick brown fox jumps over a lazy dog/', output: {fullPathFolder: 'c:/Dropbox/Websites/pldrGallery/git/demo/special-characters/pangram - The quick brown fox jumps over a lazy dog/', path: '/special-characters/pangram - The quick brown fox jumps over a lazy dog/', queryPath: '/special-characters/pangram - The quick brown fox jumps over a lazy dog/'}},
            {path: '/special-characters/pangram - Vypätá dcéra grófa Maxwella s IQ nižším ako kôň núti čeľaď hrýzť hŕbu jabĺk/', output: {fullPathFolder: 'c:/Dropbox/Websites/pldrGallery/git/demo/special-characters/pangram - Vypätá dcéra grófa Maxwella s IQ nižším ako kôň núti čeľaď hrýzť hŕbu jabĺk/', path: '/special-characters/pangram - Vypätá dcéra grófa Maxwella s IQ nižším ako kôň núti čeľaď hrýzť hŕbu jabĺk/', queryPath: '/special-characters/pangram - Vypätá dcéra grófa Maxwella s IQ nižším ako kôň núti čeľaď hrýzť hŕbu jabĺk/'}},
            {path: '/special-characters/pangram - У Іўі худы жвавы чорт у зялёнай камізэльцы пабег пад\'есці фаршу з юшкай/', output: {fullPathFolder: 'c:/Dropbox/Websites/pldrGallery/git/demo/special-characters/pangram - У Іўі худы жвавы чорт у зялёнай камізэльцы пабег пад\'есці фаршу з юшкай/', path: '/special-characters/pangram - У Іўі худы жвавы чорт у зялёнай камізэльцы пабег пад\'есці фаршу з юшкай/', queryPath: '/special-characters/pangram - У Іўі худы жвавы чорт у зялёнай камізэльцы пабег пад\'есці фаршу з юшкай/'}},

            // valid files
            {path: '/permissions/secured-image-1.jpg', output: {fullPathFile: 'c:/Dropbox/Websites/pldrGallery/git/demo/permissions/secured-image-1.jpg', path: '/permissions/secured-image-1.jpg', queryPath: '/permissions/secured-image-1.jpg'}},
            {path: '/special-characters/tilde~in name.jpg', output: {fullPathFile: 'c:/Dropbox/Websites/pldrGallery/git/demo/special-characters/tilde~in name.jpg', path: '/special-characters/tilde~in name.jpg', queryPath: '/special-characters/tilde~in name.jpg'}},
            {path: '/special-characters/plus+sign+is treted as space in frontend.jpg', output: {fullPathFile: 'c:/Dropbox/Websites/pldrGallery/git/demo/special-characters/plus+sign+is treted as space in frontend.jpg', path: '/special-characters/plus+sign+is treted as space in frontend.jpg', queryPath: '/special-characters/plus+sign+is treted as space in frontend.jpg'}},
            {path: '/special-characters/pangram - דג סקרן שט בים מאוכזב ולפתע מצא לו חברה.jpg', output: {fullPathFile: 'c:/Dropbox/Websites/pldrGallery/git/demo/special-characters/pangram - דג סקרן שט בים מאוכזב ולפתע מצא לו חברה.jpg', path: '/special-characters/pangram - דג סקרן שט בים מאוכזב ולפתע מצא לו חברה.jpg', queryPath: '/special-characters/pangram - דג סקרן שט בים מאוכזב ולפתע מצא לו חברה.jpg'}},
        ];
        let i = 0;
        for (const data of requestedPaths) {
            let requestedPathBase64 = (new Buffer(data.path)).toString('base64');
            assert.deepStrictEqual(HFS.pathMasterCheck(basePath, requestedPathBase64, userPerms, perms.test), data.output);
            i++;
        }
    });
});