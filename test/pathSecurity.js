require('../public/js/functions.js');
const assert = require('assert');
const perms = require('../libs/permissions.js');
const HFS = require('../libs/helperFilesystem.js');
const CONFIG = require('../libs/config.js');

describe('Handle requested path', function() {
    it('Dynamic path and root permission', function() {
        const basePath = './demo/';
        const userPerms = ['/'];
        const ERROR_QUERY = 'Query path has to start with forward slash';
        const ERROR_ASTERISK = 'Asterisk is not allowed';
        const ERROR_QUESTIONMARK = 'Questionmark is not allowed';
        const ERROR_DYNAMIC = 'Dynamic path is not allowed';

        const requestedPaths = [
            {path: '/', output: {fullPathFolder: './demo/', path: '/', queryPath: '/'}},
            // check for errors ("queryPath" is always the same as "path"
            // has to start with "/"
            {path: '*', output: {error: ERROR_QUERY, queryPath: '*'}},
            {path: '%2A', output: {error: ERROR_QUERY, queryPath: '*'}},
            {path: '?', output: {error: ERROR_QUERY, queryPath: '?'}},
            {path: '%3F', output: {error: ERROR_QUERY, queryPath: '?'}},
            {path: './some-path/../', output: {error: ERROR_QUERY, queryPath: './some-path/../'}},
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
            {path: '/', output: {fullPathFolder: './demo/', path: '/', queryPath: '/'}},
            {path: '/', output: {fullPathFolder: './demo/', path: '/', queryPath: '/'}},
            {path: '/', output: {fullPathFolder: './demo/', path: '/', queryPath: '/'}},
            {path: '/', output: {fullPathFolder: './demo/', path: '/', queryPath: '/'}},
        ];
        for (const data of requestedPaths) {
            console.log('** Testing path  ' + data.path);
            let requestedPathBase64 = (new Buffer(data.path)).toString('base64');
            assert.deepStrictEqual(HFS.pathMasterCheck(basePath, requestedPathBase64, userPerms, perms.test), data.output);
        }
    });
});