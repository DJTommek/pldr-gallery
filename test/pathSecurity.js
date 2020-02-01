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

    const dynamicPath = './demo/';
    const absolutePath = 'c:/Dropbox/Websites/pldrGallery/git/demo/'; // Note: update to your own path
    let userPerms = ['/'];
    // shortcut for absolute path

    /**
     * Run tests on both absolute and dynamic path
     **/
    function runAsserts(inputs) {
        for (const data of inputs) {
            let requestedPathBase64 = (new Buffer(data.path)).toString('base64');
            let dynamicOutput = {};
            let absoluteOutput = {};
            for (const key in data.output) {
                dynamicOutput[key] = data.output[key].formatUnicorn(dynamicPath);
                absoluteOutput[key] = data.output[key].formatUnicorn(absolutePath);
            }
            assert.deepStrictEqual(HFS.pathMasterCheck(dynamicPath, requestedPathBase64, userPerms, perms.test), dynamicOutput);
            assert.deepStrictEqual(HFS.pathMasterCheck(absolutePath, requestedPathBase64, userPerms, perms.test), absoluteOutput);
        }
    }

    it('Invalid string in requested path', function() {
        runAsserts([
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
        ]);
    });

    it('Invalid files and folders', function() {
        runAsserts([
            // file missing
            {path: '/non-exist-file.png', output: {error: 'Cant load "/non-exist-file.png", error: ENOENT: no such file or directory, lstat \'{0}non-exist-file.png\'', queryPath: '/non-exist-file.png'}},

            // folder missing
            {path: '/non-exist-folder/', output: {error: 'Cant load "/non-exist-folder/", error: ENOENT: no such file or directory, lstat \'{0}non-exist-folder/\'', queryPath: '/non-exist-folder/'}},

            // requested file but it is folder
            {path: '/permissions', output: {error: 'Requested path "/permissions" is not file', queryPath: '/permissions'}},

            // requested folder but it is file
            {path: '/permissions/secured-image-1.jpg/', output: {error: 'Requested path "/permissions/secured-image-1.jpg/" is not folder', queryPath: '/permissions/secured-image-1.jpg/'}},
        ]);
    });

    it('Valid requests', function() {
        runAsserts([
            {path: '/', output: {fullPathFolder: '{0}', path: '/', queryPath: '/'}},
            // valid folders
            {path: '/', output: {fullPathFolder: '{0}', path: '/', queryPath: '/'}},
            {path: '/permissions/', output: {fullPathFolder: '{0}permissions/', path: '/permissions/', queryPath: '/permissions/'}},
            {path: '/special-characters/', output: {fullPathFolder: '{0}special-characters/', path: '/special-characters/', queryPath: '/special-characters/'}},
            {path: '/special-characters/اللغة العربية‎‎/', output: {fullPathFolder: '{0}special-characters/اللغة العربية‎‎/', path: '/special-characters/اللغة العربية‎‎/', queryPath: '/special-characters/اللغة العربية‎‎/'}},
            {path: '/special-characters/arabian-اللغة العربية‎‎/', output: {fullPathFolder: '{0}special-characters/arabian-اللغة العربية‎‎/', path: '/special-characters/arabian-اللغة العربية‎‎/', queryPath: '/special-characters/arabian-اللغة العربية‎‎/'}},
            {path: '/special-characters/pangram - J.Q. Vandz struck my big fox whelp/', output: {fullPathFolder: '{0}special-characters/pangram - J.Q. Vandz struck my big fox whelp/', path: '/special-characters/pangram - J.Q. Vandz struck my big fox whelp/', queryPath: '/special-characters/pangram - J.Q. Vandz struck my big fox whelp/'}},
            {path: '/special-characters/pangram - Kŕdeľ šťastných ďatľov učí pri ústí Váhu mĺkveho koňa obhrýzať kôru a žrať čerstvé mäso/', output: {fullPathFolder: '{0}special-characters/pangram - Kŕdeľ šťastných ďatľov učí pri ústí Váhu mĺkveho koňa obhrýzať kôru a žrať čerstvé mäso/', path: '/special-characters/pangram - Kŕdeľ šťastných ďatľov učí pri ústí Váhu mĺkveho koňa obhrýzať kôru a žrať čerstvé mäso/', queryPath: '/special-characters/pangram - Kŕdeľ šťastných ďatľov učí pri ústí Váhu mĺkveho koňa obhrýzať kôru a žrať čerstvé mäso/'}},
            {path: '/special-characters/pangram - Nechť již hříšné saxofony ďáblů rozezvučí síň úděsnými tóny waltzu, tanga a quickstepu/', output: {fullPathFolder: '{0}special-characters/pangram - Nechť již hříšné saxofony ďáblů rozezvučí síň úděsnými tóny waltzu, tanga a quickstepu/', path: '/special-characters/pangram - Nechť již hříšné saxofony ďáblů rozezvučí síň úděsnými tóny waltzu, tanga a quickstepu/', queryPath: '/special-characters/pangram - Nechť již hříšné saxofony ďáblů rozezvučí síň úděsnými tóny waltzu, tanga a quickstepu/'}},
            {path: '/special-characters/pangram - Portez ce vieux whisky au juge blond qui fume!/', output: {fullPathFolder: '{0}special-characters/pangram - Portez ce vieux whisky au juge blond qui fume!/', path: '/special-characters/pangram - Portez ce vieux whisky au juge blond qui fume!/', queryPath: '/special-characters/pangram - Portez ce vieux whisky au juge blond qui fume!/'}},
            {path: '/special-characters/pangram - příliš žluťoučký kůň úpěl ďábelské ódy/', output: {fullPathFolder: '{0}special-characters/pangram - příliš žluťoučký kůň úpěl ďábelské ódy/', path: '/special-characters/pangram - příliš žluťoučký kůň úpěl ďábelské ódy/', queryPath: '/special-characters/pangram - příliš žluťoučký kůň úpěl ďábelské ódy/'}},
            {path: '/special-characters/pangram - The quick brown fox jumps over a lazy dog/', output: {fullPathFolder: '{0}special-characters/pangram - The quick brown fox jumps over a lazy dog/', path: '/special-characters/pangram - The quick brown fox jumps over a lazy dog/', queryPath: '/special-characters/pangram - The quick brown fox jumps over a lazy dog/'}},
            {path: '/special-characters/pangram - Vypätá dcéra grófa Maxwella s IQ nižším ako kôň núti čeľaď hrýzť hŕbu jabĺk/', output: {fullPathFolder: '{0}special-characters/pangram - Vypätá dcéra grófa Maxwella s IQ nižším ako kôň núti čeľaď hrýzť hŕbu jabĺk/', path: '/special-characters/pangram - Vypätá dcéra grófa Maxwella s IQ nižším ako kôň núti čeľaď hrýzť hŕbu jabĺk/', queryPath: '/special-characters/pangram - Vypätá dcéra grófa Maxwella s IQ nižším ako kôň núti čeľaď hrýzť hŕbu jabĺk/'}},
            {path: '/special-characters/pangram - У Іўі худы жвавы чорт у зялёнай камізэльцы пабег пад\'есці фаршу з юшкай/', output: {fullPathFolder: '{0}special-characters/pangram - У Іўі худы жвавы чорт у зялёнай камізэльцы пабег пад\'есці фаршу з юшкай/', path: '/special-characters/pangram - У Іўі худы жвавы чорт у зялёнай камізэльцы пабег пад\'есці фаршу з юшкай/', queryPath: '/special-characters/pangram - У Іўі худы жвавы чорт у зялёнай камізэльцы пабег пад\'есці фаршу з юшкай/'}},

            // valid files
            {path: '/permissions/secured-image-1.jpg', output: {fullPathFile: '{0}permissions/secured-image-1.jpg', path: '/permissions/secured-image-1.jpg', queryPath: '/permissions/secured-image-1.jpg'}},
            {path: '/special-characters/tilde~in name.jpg', output: {fullPathFile: '{0}special-characters/tilde~in name.jpg', path: '/special-characters/tilde~in name.jpg', queryPath: '/special-characters/tilde~in name.jpg'}},
            {path: '/special-characters/plus+sign+is treted as space in frontend.jpg', output: {fullPathFile: '{0}special-characters/plus+sign+is treted as space in frontend.jpg', path: '/special-characters/plus+sign+is treted as space in frontend.jpg', queryPath: '/special-characters/plus+sign+is treted as space in frontend.jpg'}},
            {path: '/special-characters/pangram - דג סקרן שט בים מאוכזב ולפתע מצא לו חברה.jpg', output: {fullPathFile: '{0}special-characters/pangram - דג סקרן שט בים מאוכזב ולפתע מצא לו חברה.jpg', path: '/special-characters/pangram - דג סקרן שט בים מאוכזב ולפתע מצא לו חברה.jpg', queryPath: '/special-characters/pangram - דג סקרן שט בים מאוכזב ולפתע מצא לו חברה.jpg'}},
        ]);
    });
});