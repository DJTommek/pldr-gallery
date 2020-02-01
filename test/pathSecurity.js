require('../public/js/functions.js');
const assert = require('assert');
const perms = require('../libs/permissions.js');
const HFS = require('../libs/helperFilesystem.js');
const CONFIG = require('../libs/config.js');

describe('Handle requested path', function() {
    it('Dynamic path and root permission', function() {
        const basePath = './demo/';
        const userPerms = ['/'];

        const ERROR_BACKSLASH = 'Backslash is not allowed';
        const ERROR_DYNAMIC = 'Dynamic path is not allowed';
        const ERROR_QUERY = 'Query path has to start with forward slash';
        const ERROR_ASTERISK = 'Asterisk is not allowed';
        const ERROR_QUESTIONMARK = 'Questionmark is not allowed';

        const requestedPaths = [
            {path: '/', output: {fullPathFolder: './demo/', path: '/', queryPath: '/'}},
            // check for errors ("queryPath" is always the same as "path")
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
            {path: '/demo', output: {error: 'Cant load "/demo", error: ENOENT: no such file or directory, lstat \'./demo/demo\'', queryPath: '/demo'}},
            // folder missing
            {path: '/demo/', output: {error: 'Cant load "/demo/", error: ENOENT: no such file or directory, lstat \'./demo/demo/\'', queryPath: '/demo/'}},
            // requested file but it is folder
            {path: '/non-logged', output: {error: 'Requested path "/non-logged" is not file', queryPath: '/non-logged'}},
            // requested folder but it is file
            {path: '/image-1.jpg/', output: {error: 'Requested path "/image-1.jpg/" is not folder', queryPath: '/image-1.jpg/'}},
            // valid folders
            {path: '/', output: {fullPathFolder: './demo/', path: '/', queryPath: '/'}},
            {path: '/non-logged/', output: {fullPathFolder: './demo/non-logged/', path: '/non-logged/', queryPath: '/non-logged/'}},
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
            // {path: '/special-characters/', output: {fullPathFolder: './demo/special-characters/', path: '/special-characters/', queryPath: '/special-characters/'}},
            // {path: '/special-characters/', output: {fullPathFolder: './demo/special-characters/', path: '/special-characters/', queryPath: '/special-characters/'}},
            // {path: '/special-characters/', output: {fullPathFolder: './demo/special-characters/', path: '/special-characters/', queryPath: '/special-characters/'}},
            // {path: '/special-characters/', output: {fullPathFolder: './demo/special-characters/', path: '/special-characters/', queryPath: '/special-characters/'}},
            // valid files
            {path: '/image-1.jpg', output: {fullPathFile: './demo/image-1.jpg', path: '/image-1.jpg', queryPath: '/image-1.jpg'}},
            {path: '/special-characters/plus+sign+is treted as space in frontend.jpg', output: {fullPathFile: './demo/special-characters/plus+sign+is treted as space in frontend.jpg', path: '/special-characters/plus+sign+is treted as space in frontend.jpg', queryPath: '/special-characters/plus+sign+is treted as space in frontend.jpg'}},
            // {path: '/special-characters/', output: {fullPathFile: './demo/special-characters/', path: '/special-characters/', queryPath: '/special-characters/'}},
            // {path: '/special-characters/', output: {fullPathFile: './demo/special-characters/', path: '/special-characters/', queryPath: '/special-characters/'}},
            // {path: '/special-characters/', output: {fullPathFile: './demo/special-characters/', path: '/special-characters/', queryPath: '/special-characters/'}},
            // {path: '/special-characters/', output: {fullPathFile: './demo/special-characters/', path: '/special-characters/', queryPath: '/special-characters/'}},
            {path: '/special-characters/pangram - דג סקרן שט בים מאוכזב ולפתע מצא לו חברה.jpg', output: {fullPathFile: './demo/special-characters/pangram - דג סקרן שט בים מאוכזב ולפתע מצא לו חברה.jpg', path: '/special-characters/pangram - דג סקרן שט בים מאוכזב ולפתע מצא לו חברה.jpg', queryPath: '/special-characters/pangram - דג סקרן שט בים מאוכזב ולפתע מצא לו חברה.jpg'}},
        ];
        for (const data of requestedPaths) {
            let requestedPathBase64 = (new Buffer(data.path)).toString('base64');
            assert.deepStrictEqual(HFS.pathMasterCheck(basePath, requestedPathBase64, userPerms, perms.test), data.output);
        }
    });
});