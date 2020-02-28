require('../private/js/functions.js');

const assert = require('assert');
const PERMS = require(BASE_DIR_GET('/libs/permissions.js'));
const HFS = require(BASE_DIR_GET('/libs/helperFileSystem.js'));

describe('Handle requested path', function () {
	const ERROR_URI = 'URI malformed';
	const ERROR_BACKSLASH = 'Backslash is not allowed';
	const ERROR_DYNAMIC = 'Dynamic path is not allowed';
	const ERROR_QUERY = 'Query path has to start with forward slash';
	const ERROR_ASTERISK = 'Asterisk is not allowed';
	const ERROR_QUESTIONMARK = 'Questionmark is not allowed';

	// generate absolute URL from dynamic path
	const absolutePath = BASE_DIR_GET('/demo/');

	/**
	 * Run deepStrictEqual test
	 *
	 * @param {string} path
	 * @param {Array.<String>} perms
	 * @param {Object.<string, string>} output
	 */
	function runAssert(path, perms, output) {
		// it is nicer to read in classic string instead of base64 format. So tests are written in nice format and converted to base64 here
		const requestedPathBase64 = (new Buffer.from(path)).toString('base64');
		let absoluteOutput = {};
		// convert all placeholders in all output object strings with dynamic and absolute paths, depending what test is currently running
		for (const key in output) {
			absoluteOutput[key] = output[key].formatUnicorn(absolutePath);
		}
		assert.deepStrictEqual(HFS.pathMasterCheck(absolutePath, requestedPathBase64, perms, PERMS.test), absoluteOutput);
	}
	it('Invalid URI', function () {
		const malformedURI = 'JTJGZmlsZXMlMkYyMDAyLjExJTIwRG9tYSU';
		assert.deepStrictEqual(HFS.pathMasterCheck(absolutePath, malformedURI, ['/'], PERMS.test), {
			error: ERROR_URI
		});
	});


	it('Invalid string in requested path', function () {
		runAssert('\\', ['/'], {error: ERROR_BACKSLASH, queryPath: '\\'});
		// backslash
		runAssert('\\', ['/'], {error: ERROR_BACKSLASH, queryPath: '\\'});
		runAssert('some path\\', ['/'], {error: ERROR_BACKSLASH, queryPath: 'some path\\'});
		runAssert('/some path\\', ['/'], {error: ERROR_BACKSLASH, queryPath: '/some path\\'});
		runAssert('%5C', ['/'], {error: ERROR_BACKSLASH, queryPath: '\\'});
		runAssert('*\\', ['/'], {error: ERROR_BACKSLASH, queryPath: '*\\'});
		runAssert('/some/long/path\\back/', ['/'], {error: ERROR_BACKSLASH, queryPath: '/some/long/path\\back/'});

		// has to start with "/"
		runAssert('*', ['/'], {error: ERROR_QUERY, queryPath: '*'});
		runAssert('%2A', ['/'], {error: ERROR_QUERY, queryPath: '*'});
		runAssert('?', ['/'], {error: ERROR_QUERY, queryPath: '?'});
		runAssert('%3F', ['/'], {error: ERROR_QUERY, queryPath: '?'});
		runAssert('./some-path/../', ['/'], {error: ERROR_QUERY, queryPath: './some-path/../'});
		runAssert('demo', ['/'], {error: ERROR_QUERY, queryPath: 'demo'});

		// asterisk
		runAssert('/*/', ['/'], {error: ERROR_ASTERISK, queryPath: '/*/'});
		runAssert('/demo/*/', ['/'], {error: ERROR_ASTERISK, queryPath: '/demo/*/'});
		runAssert('/%2A/', ['/'], {error: ERROR_ASTERISK, queryPath: '/*/'});

		// questionmark
		runAssert('/?/', ['/'], {error: ERROR_QUESTIONMARK, queryPath: '/?/'});
		runAssert('/some-path/?/', ['/'], {error: ERROR_QUESTIONMARK, queryPath: '/some-path/?/'});
		runAssert('/blah path?', ['/'], {error: ERROR_QUESTIONMARK, queryPath: '/blah path?'});
		runAssert('/%3F/', ['/'], {error: ERROR_QUESTIONMARK, queryPath: '/?/'});

		// Dynamic path
		runAssert('/../', ['/'], {error: ERROR_DYNAMIC, queryPath: '/../'});
		runAssert('/./', ['/'], {error: ERROR_DYNAMIC, queryPath: '/./'});
		runAssert('/some-path/../', ['/'], {error: ERROR_DYNAMIC, queryPath: '/some-path/../'});
		runAssert('/../some-path/', ['/'], {error: ERROR_DYNAMIC, queryPath: '/../some-path/'});
		runAssert('/../some-path/../', ['/'], {error: ERROR_DYNAMIC, queryPath: '/../some-path/../'});
	});

	it('Invalid files and folders', function () {
		// file missing
		runAssert('/non-exist-file.png', ['/'], {
			error: 'Cant load "/non-exist-file.png", error: ENOENT: no such file or directory, lstat \'{0}non-exist-file.png\'',
			queryPath: '/non-exist-file.png'
		});

		// folder missing
		runAssert('/non-exist-folder/', ['/'], {
			error: 'Cant load "/non-exist-folder/", error: ENOENT: no such file or directory, lstat \'{0}non-exist-folder/\'',
			queryPath: '/non-exist-folder/'
		});

		// requested file but it is folder
		runAssert('/permissions', ['/'], {
			error: 'Requested path "/permissions" is not file',
			queryPath: '/permissions'
		});

		// requested folder but it is file
		runAssert('/permissions/secured-image-1.jpg/', ['/'], {
			error: 'Requested path "/permissions/secured-image-1.jpg/" is not folder',
			queryPath: '/permissions/secured-image-1.jpg/'
		});
	});

	it('Valid requests', function () {
		runAssert('/', ['/'], {fullPathFolder: '{0}', path: '/', queryPath: '/'});
		// valid folders
		runAssert('/', ['/'], {fullPathFolder: '{0}', path: '/', queryPath: '/'});
		runAssert('/permissions/', ['/'], {
			fullPathFolder: '{0}permissions/',
			path: '/permissions/',
			queryPath: '/permissions/'
		});
		runAssert('/special-characters/', ['/'], {
			fullPathFolder: '{0}special-characters/',
			path: '/special-characters/',
			queryPath: '/special-characters/'
		});
		runAssert('/special-characters/اللغة العربية‎‎/', ['/'], {
			fullPathFolder: '{0}special-characters/اللغة العربية‎‎/',
			path: '/special-characters/اللغة العربية‎‎/',
			queryPath: '/special-characters/اللغة العربية‎‎/'
		});
		runAssert('/special-characters/arabian-اللغة العربية‎‎/', ['/'], {
			fullPathFolder: '{0}special-characters/arabian-اللغة العربية‎‎/',
			path: '/special-characters/arabian-اللغة العربية‎‎/',
			queryPath: '/special-characters/arabian-اللغة العربية‎‎/'
		});
		runAssert('/special-characters/pangram - J.Q. Vandz struck my big fox whelp/', ['/'], {
			fullPathFolder: '{0}special-characters/pangram - J.Q. Vandz struck my big fox whelp/',
			path: '/special-characters/pangram - J.Q. Vandz struck my big fox whelp/',
			queryPath: '/special-characters/pangram - J.Q. Vandz struck my big fox whelp/'
		});
		runAssert('/special-characters/pangram - Kŕdeľ šťastných ďatľov učí pri ústí Váhu mĺkveho koňa obhrýzať kôru a žrať čerstvé mäso/', ['/'], {
			fullPathFolder: '{0}special-characters/pangram - Kŕdeľ šťastných ďatľov učí pri ústí Váhu mĺkveho koňa obhrýzať kôru a žrať čerstvé mäso/',
			path: '/special-characters/pangram - Kŕdeľ šťastných ďatľov učí pri ústí Váhu mĺkveho koňa obhrýzať kôru a žrať čerstvé mäso/',
			queryPath: '/special-characters/pangram - Kŕdeľ šťastných ďatľov učí pri ústí Váhu mĺkveho koňa obhrýzať kôru a žrať čerstvé mäso/'
		});
		runAssert('/special-characters/pangram - Nechť již hříšné saxofony ďáblů rozezvučí síň úděsnými tóny waltzu, tanga a quickstepu/', ['/'], {
			fullPathFolder: '{0}special-characters/pangram - Nechť již hříšné saxofony ďáblů rozezvučí síň úděsnými tóny waltzu, tanga a quickstepu/',
			path: '/special-characters/pangram - Nechť již hříšné saxofony ďáblů rozezvučí síň úděsnými tóny waltzu, tanga a quickstepu/',
			queryPath: '/special-characters/pangram - Nechť již hříšné saxofony ďáblů rozezvučí síň úděsnými tóny waltzu, tanga a quickstepu/'
		});
		runAssert('/special-characters/pangram - Portez ce vieux whisky au juge blond qui fume!/', ['/'], {
			fullPathFolder: '{0}special-characters/pangram - Portez ce vieux whisky au juge blond qui fume!/',
			path: '/special-characters/pangram - Portez ce vieux whisky au juge blond qui fume!/',
			queryPath: '/special-characters/pangram - Portez ce vieux whisky au juge blond qui fume!/'
		});
		runAssert('/special-characters/pangram - příliš žluťoučký kůň úpěl ďábelské ódy/', ['/'], {
			fullPathFolder: '{0}special-characters/pangram - příliš žluťoučký kůň úpěl ďábelské ódy/',
			path: '/special-characters/pangram - příliš žluťoučký kůň úpěl ďábelské ódy/',
			queryPath: '/special-characters/pangram - příliš žluťoučký kůň úpěl ďábelské ódy/'
		});
		runAssert('/special-characters/pangram - The quick brown fox jumps over a lazy dog/', ['/'], {
			fullPathFolder: '{0}special-characters/pangram - The quick brown fox jumps over a lazy dog/',
			path: '/special-characters/pangram - The quick brown fox jumps over a lazy dog/',
			queryPath: '/special-characters/pangram - The quick brown fox jumps over a lazy dog/'
		});
		runAssert('/special-characters/pangram - Vypätá dcéra grófa Maxwella s IQ nižším ako kôň núti čeľaď hrýzť hŕbu jabĺk/', ['/'], {
			fullPathFolder: '{0}special-characters/pangram - Vypätá dcéra grófa Maxwella s IQ nižším ako kôň núti čeľaď hrýzť hŕbu jabĺk/',
			path: '/special-characters/pangram - Vypätá dcéra grófa Maxwella s IQ nižším ako kôň núti čeľaď hrýzť hŕbu jabĺk/',
			queryPath: '/special-characters/pangram - Vypätá dcéra grófa Maxwella s IQ nižším ako kôň núti čeľaď hrýzť hŕbu jabĺk/'
		});
		runAssert('/special-characters/pangram - У Іўі худы жвавы чорт у зялёнай камізэльцы пабег пад\'есці фаршу з юшкай/', ['/'], {
			fullPathFolder: '{0}special-characters/pangram - У Іўі худы жвавы чорт у зялёнай камізэльцы пабег пад\'есці фаршу з юшкай/',
			path: '/special-characters/pangram - У Іўі худы жвавы чорт у зялёнай камізэльцы пабег пад\'есці фаршу з юшкай/',
			queryPath: '/special-characters/pangram - У Іўі худы жвавы чорт у зялёнай камізэльцы пабег пад\'есці фаршу з юшкай/'
		});

		// valid files
		runAssert('/permissions/secured-image-1.jpg', ['/'], {
			fullPathFile: '{0}permissions/secured-image-1.jpg',
			path: '/permissions/secured-image-1.jpg',
			queryPath: '/permissions/secured-image-1.jpg'
		});
		runAssert('/special-characters/tilde~in name.jpg', ['/'], {
			fullPathFile: '{0}special-characters/tilde~in name.jpg',
			path: '/special-characters/tilde~in name.jpg',
			queryPath: '/special-characters/tilde~in name.jpg'
		});
		runAssert('/special-characters/plus+sign+is treted as space in frontend.jpg', ['/'], {
			fullPathFile: '{0}special-characters/plus+sign+is treted as space in frontend.jpg',
			path: '/special-characters/plus+sign+is treted as space in frontend.jpg',
			queryPath: '/special-characters/plus+sign+is treted as space in frontend.jpg'
		});
		runAssert('/special-characters/pangram - דג סקרן שט בים מאוכזב ולפתע מצא לו חברה.jpg', ['/'], {
			fullPathFile: '{0}special-characters/pangram - דג סקרן שט בים מאוכזב ולפתע מצא לו חברה.jpg',
			path: '/special-characters/pangram - דג סקרן שט בים מאוכזב ולפתע מצא לו חברה.jpg',
			queryPath: '/special-characters/pangram - דג סקרן שט בים מאוכזב ולפתע מצא לו חברה.jpg'
		});
	});
});