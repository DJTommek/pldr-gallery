require('../src/webserver/private/js/functions.js');
const assert = require('assert');

describe('Test all functions from functions.js', function () {
	it('String.replaceAll()', function () {
		assert.strictEqual('text without spaces'.replaceAll(' ', '-'), 'text-without-spaces');
		assert.strictEqual('text without spaces'.replaceAll(' ', ''), 'textwithoutspaces');
		assert.strictEqual('don\'t change this text'.replaceAll('+', 'FOO'), 'don\'t change this text');
		assert.strictEqual('text-without-spaces'.replaceAll('-', ''), 'textwithoutspaces');
		assert.strictEqual('special.regex.char'.replaceAll('.', '\\'), 'special\\regex\\char');
		assert.strictEqual('specia1regex[0-9]expression'.replaceAll('[0-9]', 'FOO'), 'specia1regexFOOexpression');
		// regex tests
		assert.strictEqual('in this text 5replace999 numbers'.replaceAll(/[0-9]+/, 'FOO'), 'in this text FOOreplaceFOO numbers');
		assert.strictEqual('in this text replace some characters with exclamation mark'.replaceAll(/[acg]/, '!'), 'in this text repl!!e some !h!r!!ters with ex!l!m!tion m!rk');
	});

	it('String.pad()', function () {
		// pad default
		assert.strictEqual('pad right'.pad(15), 'pad right      ');
		assert.strictEqual('pad right char'.pad(20, '0'), 'pad right char000000');
		assert.strictEqual('pad right chars'.pad(20, 'ab'), 'pad right charsababa');
		// pad right
		assert.strictEqual('pad right manual'.pad(20, '!', 'right'), 'pad right manual!!!!');
		assert.strictEqual('pad right manual '.pad(20, '!', 'right'), 'pad right manual !!!');
		assert.strictEqual('pad right manual '.pad(20, '!-', 'right'), 'pad right manual !-!');
		// pad left
		assert.strictEqual('pad left'.pad(15, ' ', 'left'), '       pad left');
		assert.strictEqual('pad left char'.pad(20, '0', 'left'), '0000000pad left char');
		assert.strictEqual(' pad left chars'.pad(19, 'ab', 'left'), 'abab pad left chars');
		assert.strictEqual(' pad left chars'.pad(20, 'ab', 'left'), 'ababa pad left chars');
		// pad center with one character
		assert.strictEqual('a'.pad(1, '-', 'both'), 'a');
		assert.strictEqual('a'.pad(2, '-', 'both'), '-a');
		assert.strictEqual('a'.pad(3, '-', 'both'), '-a-');
		assert.strictEqual('a'.pad(4, '-', 'both'), '--a-');
		// pad center with more characters
		assert.strictEqual('a'.pad(1, '!-', 'both'), 'a');
		assert.strictEqual('a'.pad(2, '!-', 'both'), '!a');
		assert.strictEqual('a'.pad(3, '!-', 'both'), '!a!');
		assert.strictEqual('a'.pad(4, '!-', 'both'), '!-a!');
		assert.strictEqual('a'.pad(5, '!-', 'both'), '!-a!-');
		assert.strictEqual('a'.pad(6, '!-', 'both'), '!-!a!-');
		assert.strictEqual('a'.pad(7, '!-', 'both'), '!-!a!-!');
		assert.strictEqual('pad center'.pad(20, '-', 'both'), '-----pad center-----');
		// length parameter
		assert.throws('string'.pad);
		assert.throws(() => 'string'.pad(0));
		assert.throws(() => 'string'.pad(-1));
		assert.throws(() => 'string'.pad(null));
		assert.throws(() => 'string'.pad(''));
		assert.throws(() => 'string'.pad({}));
		// string parameters
		assert.throws(() => 'string'.pad(1, ''));
		assert.throws(() => 'string'.pad(1, 1));
		assert.throws(() => 'string'.pad(1, null));
		assert.throws(() => 'string'.pad(1, {}));
		assert.throws(() => 'string'.pad(1, /[0-9]/));
		// type parameters
		assert.throws(() => 'string'.pad(1, ' ', null));
		assert.throws(() => 'string'.pad(1, ' ', 'bla'));
		assert.throws(() => 'string'.pad(1, ' ', 'LEFT'));
		assert.throws(() => 'string'.pad(1, ' ', 'center'));
	});

	it('String.formatUnicorn()', function () {
		const result = 'pldrGallery is cool and author is cool too';
		assert.strictEqual('{0} is {2} and {1} is {2} too'.formatUnicorn('pldrGallery', 'author', 'cool'), result);
		assert.strictEqual('{name1} is {what} and {name2} is {what} too'.formatUnicorn({'name1': 'pldrGallery', 'name2': 'author', 'what': 'cool'}), result);
		// non-string parameters
		assert.strictEqual('change {0} this'.formatUnicorn(1), 'change 1 this');
		// dont change
		assert.strictEqual('just print {0} zero'.formatUnicorn(), 'just print {0} zero');
		assert.strictEqual('just print {1} one'.formatUnicorn(), 'just print {1} one');
		assert.strictEqual('just print {} brackets'.formatUnicorn(), 'just print {} brackets');
		// parameters dont know what to replace
		assert.strictEqual('dont change'.formatUnicorn('param1', 'param2'), 'dont change');
		assert.strictEqual('dont change'.formatUnicorn({'bla': 'ble', 'foo': 'bar'}), 'dont change');
		assert.strictEqual('dont change'.formatUnicorn(null), 'dont change');
		assert.strictEqual('dont change'.formatUnicorn(1), 'dont change');
	});

	it('String.escapeRegex()', function () {
		// @TODO
	});

	it('String.escapeHtml()', function () {
		// @TODO
	});

	it('Array.last()', function () {
		assert.strictEqual(['a'].last(), 'a');
		assert.strictEqual(['a'].last(1), 'a');
		assert.strictEqual(['a', 'b'].last(2), 'a');
		assert.strictEqual(['a', 'b'].last(1), 'b');
		assert.deepStrictEqual([['a', 'b']].last(1), ['a', 'b']);
		assert.deepStrictEqual(['a', ['a', 'b']].last(1), ['a', 'b']);
		assert.deepStrictEqual(['a', ['a', 'b']].last(2), 'a');

		assert.strictEqual([].last(), undefined);
		assert.strictEqual([].last(1), undefined);
		assert.strictEqual(['a'].last(2), undefined);
		// should throw error
		assert.throws(() => [].last(0));
	});

	it('Array.inArray()', function () {
		assert.strictEqual(['a'].inArray('a'), true);
		assert.strictEqual(['a', 'b'].inArray('a'), true);
		assert.strictEqual(['a', 'b'].inArray('b'), true);
		assert.strictEqual(['a', 1].inArray(1), true);

		assert.strictEqual(['a'].inArray('c'), false);
		assert.strictEqual(['a', 'b'].inArray('c'), false);
		assert.strictEqual(['a', 'b'].inArray('c'), false);
		assert.strictEqual(['a', 1].inArray('1'), false);
	});

	it('Array.removeByValue()', function () {
		assert.deepStrictEqual(['a'].removeByValue('a'), []);
		assert.deepStrictEqual(['a', 'b'].removeByValue('a'), ['b']);
		assert.deepStrictEqual(['a', 'b', 'c'].removeByValue('b'), ['a', 'c']);
		assert.deepStrictEqual(['a', 'a', 'b'].removeByValue('a'), ['b']); // multiple same values
	});

	it('Array.pushUnique()', function () {
		assert.deepStrictEqual(['a'].pushUnique('a'), ['a']);
		assert.deepStrictEqual(['a', 'a'].pushUnique('a'), ['a', 'a']);
		assert.deepStrictEqual(['a'].pushUnique('b'), ['a', 'b']);
		assert.deepStrictEqual(['a', 'a'].pushUnique('b'), ['a', 'a', 'b']);
	});

	it('formatBytes()', function () {
		assert.strictEqual(formatBytes(0), '0 B');
		assert.strictEqual(formatBytes(1), '1 B');
		assert.strictEqual(formatBytes(1023), '1023 B');
		assert.strictEqual(formatBytes(1024), '1 KB');
		assert.strictEqual(formatBytes(1025), '1 KB');
		assert.strictEqual(formatBytes(1025, 3), '1.001 KB');
		assert.strictEqual(formatBytes(1500, 0), '1 KB');
		assert.strictEqual(formatBytes(1500, 1), '1.5 KB');
		assert.strictEqual(formatBytes(1500), '1.46 KB');
		assert.strictEqual(formatBytes(1500, 2), '1.46 KB');
		assert.strictEqual(formatBytes(9999999), '9.54 MB');
		assert.strictEqual(formatBytes(9999999999), '9.31 GB');
		assert.strictEqual(formatBytes(99999999999999), '90.95 TB');
		assert.strictEqual(formatBytes(9999999999999999), '8.88 PB');
		assert.strictEqual(formatBytes(9999999999999999999), '8.67 EB');
		assert.strictEqual(formatBytes(99999999999999999999999), '84.7 ZB');
		assert.strictEqual(formatBytes(9999999999999999999999999), '8.27 YB');
		assert.strictEqual(formatBytes(1208925819614629174706176), '1 YB');
	});

	it('hrtime()', function () {
		// @TODO add testsing of hrtime()
	});

	it('isNumeric()', function () {
		// true
		assert.strictEqual(isNumeric(0), true);
		assert.strictEqual(isNumeric('0'), true);
		assert.strictEqual(isNumeric(-0), true);
		assert.strictEqual(isNumeric('-0'), true);
		assert.strictEqual(isNumeric(1), true);
		assert.strictEqual(isNumeric('1'), true);
		assert.strictEqual(isNumeric(-1), true);
		assert.strictEqual(isNumeric('-1'), true);
		assert.strictEqual(isNumeric(1.1), true);
		assert.strictEqual(isNumeric('1.1'), true);
		assert.strictEqual(isNumeric(-1.1), true);
		assert.strictEqual(isNumeric('-1.1'), true);
		assert.strictEqual(isNumeric(99999), true);
		assert.strictEqual(isNumeric('99999'), true);
		// false
		assert.strictEqual(isNumeric(''), false);
		assert.strictEqual(isNumeric('some string'), false);
		assert.strictEqual(isNumeric('some string 1'), false);
		assert.strictEqual(isNumeric('1 some string 1'), false);
		assert.strictEqual(isNumeric([1]), false);
		assert.strictEqual(isNumeric([1, 5]), false);
		assert.strictEqual(isNumeric({'1': 1}), false);
		assert.strictEqual(isNumeric({'1': 1, '5': 1}), false);
		assert.strictEqual(isNumeric({'1': '1', '5': '1'}), false);
		assert.strictEqual(isNumeric(Infinity), false);
		assert.strictEqual(isNumeric(-Infinity), false);
	});

	it('msToHuman()', function () {
		// all units
		assert.strictEqual(msToHuman(503263836), '5d 19h 47m 43s 836ms');
		// exact times
		assert.strictEqual(msToHuman(1), '1ms');
		assert.strictEqual(msToHuman(1000), '1s');
		assert.strictEqual(msToHuman(60000), '1m');
		assert.strictEqual(msToHuman(3600000), '1h');
		assert.strictEqual(msToHuman(86400000), '1d');
		// skipping some units
		assert.strictEqual(msToHuman(3720000), '1h 2m'); // skipping seconds and miliseconds
		assert.strictEqual(msToHuman(3720010), '1h 2m 10ms'); // skipping seconds
		assert.strictEqual(msToHuman(3601000), '1h 1s'); // skipping minutes and miliseconds
		assert.strictEqual(msToHuman(3600005), '1h 5ms'); // skipping minutes and seconds
		assert.strictEqual(msToHuman(86400555), '1d 555ms'); // skipping hours, minutes and seconds
		assert.strictEqual(msToHuman(86455555), '1d 55s 555ms'); // skipping hours and minutes
		assert.strictEqual(msToHuman(86460555), '1d 1m 555ms'); // skipping hours and seconds
		// going higher and higher...
		assert.strictEqual(msToHuman(0), '0ms');
		assert.strictEqual(msToHuman(10), '10ms');
		assert.strictEqual(msToHuman(100), '100ms');
		assert.strictEqual(msToHuman(10000), '10s');
		assert.strictEqual(msToHuman(10050), '10s 50ms');
		assert.strictEqual(msToHuman(100000), '1m 40s');
		assert.strictEqual(msToHuman(1000000), '16m 40s');
		assert.strictEqual(msToHuman(10000000), '2h 46m 40s');
		assert.strictEqual(msToHuman(100000000), '1d 3h 46m 40s');
		assert.strictEqual(msToHuman(1000000000), '11d 13h 46m 40s');
		assert.strictEqual(msToHuman(10000000000), '115d 17h 46m 40s');
		// throw errors
		assert.throws(() => msToHuman());
		assert.throws(() => msToHuman('11'));
		assert.throws(() => msToHuman('fdasfds'));
		assert.throws(() => msToHuman([0]));
	});

	it('humanToMs()', function () {
		assert.strictEqual(humanToMs('0ms'), 0);
		assert.strictEqual(humanToMs('5d 20h 19m 40s 173ms'), 505180173);
		// going higher and higher...
		assert.strictEqual(humanToMs('1ms'), 1);
		assert.strictEqual(humanToMs('1s'), 1000);
		assert.strictEqual(humanToMs('1m'), 60000);
		assert.strictEqual(humanToMs('1h'), 3600000);
		assert.strictEqual(humanToMs('1d'), 86400000);
		// skipping some units
		assert.strictEqual(humanToMs('1h 2m'), 3720000);
		assert.strictEqual(humanToMs('1h 2m 10ms'), 3720010);
		assert.strictEqual(humanToMs('1h 1s'), 3601000);
		assert.strictEqual(humanToMs('1h 5ms'), 3600005);
		assert.strictEqual(humanToMs('1d 555ms'), 86400555);
		assert.strictEqual(humanToMs('1d 55s 555ms'), 86455555);
		assert.strictEqual(humanToMs('1d 1m 555ms'), 86460555);
		// going higher and higher...
		assert.strictEqual(humanToMs('0ms'), 0);
		assert.strictEqual(humanToMs('10ms'), 10);
		assert.strictEqual(humanToMs('100ms'), 100);
		assert.strictEqual(humanToMs('10s'), 10000);
		assert.strictEqual(humanToMs('10s 50ms'), 10050);
		assert.strictEqual(humanToMs('1m 40s'), 100000);
		assert.strictEqual(humanToMs('16m 40s'), 1000000);
		assert.strictEqual(humanToMs('2h 46m 40s'), 10000000);
		assert.strictEqual(humanToMs('1d 3h 46m 40s'), 100000000);
		assert.strictEqual(humanToMs('11d 13h 46m 40s'), 1000000000);
		assert.strictEqual(humanToMs('115d 17h 46m 40s'), 10000000000);

		// invalid values (subject to change, might throw error in the future)
		assert.strictEqual(humanToMs('0fasfsd ms'), 0);
		assert.strictEqual(humanToMs('fasfsd'), 0);
		// throw errors
		assert.throws(() => humanToMs());
		assert.throws(() => humanToMs(0));
		assert.throws(() => humanToMs(999));
		assert.throws(() => humanToMs([0]));
	});

	it('convertDMSToDD()', function () {
		// @TODO
	});

	it('generateGoBackPath()', function () {
		assert.strictEqual(generateGoBackPath('/folder1/'), '/');
		assert.strictEqual(generateGoBackPath('/folder1/folder2/'), '/folder1/');
		assert.strictEqual(generateGoBackPath('/folder1/folder2/folder3/'), '/folder1/folder2/');
		// throw errors
		assert.throws(() => generateGoBackPath('/'));
	});

	it('pathToUrl()', function () {
		assert.strictEqual(pathToUrl('/'), '/');
		assert.strictEqual(pathToUrl('/folder with spaces/'), '/folder+with+spaces/');
		assert.strictEqual(pathToUrl('/folder+with+plus/'), '/folder\\+with\\+plus/');
		assert.strictEqual(pathToUrl('/ěščřžýáíé/'), '/ěščřžýáíé/');
		assert.strictEqual(pathToUrl('/+ěščřžýáíé/'), '/\\+ěščřžýáíé/');
		assert.strictEqual(pathToUrl('+'), '\\+');
		assert.strictEqual(pathToUrl('+bla'), '\\+bla');
		assert.strictEqual(pathToUrl('bla+bla'), 'bla\\+bla');
		assert.strictEqual(pathToUrl('bla+'), 'bla\\+');
		assert.strictEqual(pathToUrl('/demo/folder with+spaces and+plus signs/'), '/demo/folder+with\\+spaces+and\\+plus+signs/');
	});

	it('pathFromUrl()', function () {
		assert.strictEqual(pathFromUrl('/'), '/');
		assert.strictEqual(pathFromUrl('/folder+with+spaces/'), '/folder with spaces/');
		assert.strictEqual(pathFromUrl('/folder\\+with\\+plus/'), '/folder+with+plus/');
		assert.strictEqual(pathFromUrl('/ěščřžýáíé/'), '/ěščřžýáíé/');
		assert.strictEqual(pathFromUrl('/\\+ěščřžýáíé/'), '/+ěščřžýáíé/');
		assert.strictEqual(pathFromUrl('\\+'), '+');
		assert.strictEqual(pathFromUrl('\\+bla'), '+bla');
		assert.strictEqual(pathFromUrl('bla\\+bla'), 'bla+bla');
		assert.strictEqual(pathFromUrl('bla\\+'), 'bla+');
		assert.strictEqual(pathFromUrl('/demo/folder+with\\+spaces+and\\+plus+signs/'), '/demo/folder with+spaces and+plus signs/');
	});

	it('copyToClipboard()', function () {
		// Can be tested only in browser
	});

	it('generateCoordsLinks()', function () {
		assert.deepStrictEqual(generateCoordsLinks(49.5, 14.5), {
			coords: '49.500000,14.500000',
			lat: '49.500000',
			lon: '14.500000',
			betterlocationbot: 'https://t.me/BetterLocationBot?start=49500000_14500000',
			google: 'https://www.google.cz/maps/place/49.500000,14.500000?q=49.500000,14.500000',
			here: 'https://share.here.com/r/49.500000,14.500000',
			ingress: 'https://intel.ingress.com?ll=49.500000,14.500000&pll=49.500000,14.500000',
			mapycz: 'https://mapy.cz/zakladni?y=49.500000&x=14.500000&source=coor&id=14.500000,49.500000',
			osm: 'https://www.openstreetmap.org/search?whereami=1&query=49.500000,14.500000&mlat=49.500000&mlon=14.500000#map=17/49.500000/14.500000',
			waze: 'https://www.waze.com/ul?ll=49.500000,14.500000',
			mapyczScreenshot: 'https://en.mapy.cz/screenshoter?url=https%3A%2F%2Fmapy.cz%2Fzakladni%3Fy%3D49.500000%26x%3D14.500000%26source%3Dcoor%26id%3D14.500000%2C49.500000&p=3&l=0',
		});
		assert.deepStrictEqual(generateCoordsLinks(89.888, 179.999), {
			coords: '89.888000,179.999000',
			lat: '89.888000',
			lon: '179.999000',
			betterlocationbot: 'https://t.me/BetterLocationBot?start=89888000_179999000',
			google: 'https://www.google.cz/maps/place/89.888000,179.999000?q=89.888000,179.999000',
			here: 'https://share.here.com/r/89.888000,179.999000',
			ingress: 'https://intel.ingress.com?ll=89.888000,179.999000&pll=89.888000,179.999000',
			mapycz: 'https://mapy.cz/zakladni?y=89.888000&x=179.999000&source=coor&id=179.999000,89.888000',
			osm: 'https://www.openstreetmap.org/search?whereami=1&query=89.888000,179.999000&mlat=89.888000&mlon=179.999000#map=17/89.888000/179.999000',
			waze: 'https://www.waze.com/ul?ll=89.888000,179.999000',
			mapyczScreenshot: 'https://en.mapy.cz/screenshoter?url=https%3A%2F%2Fmapy.cz%2Fzakladni%3Fy%3D89.888000%26x%3D179.999000%26source%3Dcoor%26id%3D179.999000%2C89.888000&p=3&l=0',
		});
		assert.deepStrictEqual(generateCoordsLinks(-89.888, -179.999), {
			coords: '-89.888000,-179.999000',
			lat: '-89.888000',
			lon: '-179.999000',
			betterlocationbot: 'https://t.me/BetterLocationBot?start=-89888000_-179999000',
			google: 'https://www.google.cz/maps/place/-89.888000,-179.999000?q=-89.888000,-179.999000',
			here: 'https://share.here.com/r/-89.888000,-179.999000',
			ingress: 'https://intel.ingress.com?ll=-89.888000,-179.999000&pll=-89.888000,-179.999000',
			mapycz: 'https://mapy.cz/zakladni?y=-89.888000&x=-179.999000&source=coor&id=-179.999000,-89.888000',
			osm: 'https://www.openstreetmap.org/search?whereami=1&query=-89.888000,-179.999000&mlat=-89.888000&mlon=-179.999000#map=17/-89.888000/-179.999000',
			waze: 'https://www.waze.com/ul?ll=-89.888000,-179.999000',
			mapyczScreenshot: 'https://en.mapy.cz/screenshoter?url=https%3A%2F%2Fmapy.cz%2Fzakladni%3Fy%3D-89.888000%26x%3D-179.999000%26source%3Dcoor%26id%3D-179.999000%2C-89.888000&p=3&l=0',
		});
		assert.deepStrictEqual(generateCoordsLinks(0, 0), {
			coords: '0.000000,0.000000',
			lat: '0.000000',
			lon: '0.000000',
			betterlocationbot: 'https://t.me/BetterLocationBot?start=0000000_0000000',
			google: 'https://www.google.cz/maps/place/0.000000,0.000000?q=0.000000,0.000000',
			here: 'https://share.here.com/r/0.000000,0.000000',
			ingress: 'https://intel.ingress.com?ll=0.000000,0.000000&pll=0.000000,0.000000',
			mapycz: 'https://mapy.cz/zakladni?y=0.000000&x=0.000000&source=coor&id=0.000000,0.000000',
			osm: 'https://www.openstreetmap.org/search?whereami=1&query=0.000000,0.000000&mlat=0.000000&mlon=0.000000#map=17/0.000000/0.000000',
			waze: 'https://www.waze.com/ul?ll=0.000000,0.000000',
			mapyczScreenshot: 'https://en.mapy.cz/screenshoter?url=https%3A%2F%2Fmapy.cz%2Fzakladni%3Fy%3D0.000000%26x%3D0.000000%26source%3Dcoor%26id%3D0.000000%2C0.000000&p=3&l=0',
		});
	});
});
