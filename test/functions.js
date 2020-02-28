require('../private/js/functions.js');
const assert = require('assert');

describe('Test all functions from functions.js', function () {
	it('String.replaceAll()', function () {
		assert.equal('text without spaces'.replaceAll(' ', '-'), 'text-without-spaces');
		assert.equal('text without spaces'.replaceAll(' ', ''), 'textwithoutspaces');
		assert.equal('don\'t change this text'.replaceAll('+', 'FOO'), 'don\'t change this text');
		assert.equal('text-without-spaces'.replaceAll('-', ''), 'textwithoutspaces');
		assert.equal('special.regex.char'.replaceAll('.', '\\'), 'special\\regex\\char');
		assert.equal('specia1regex[0-9]expression'.replaceAll('[0-9]', 'FOO'), 'specia1regexFOOexpression');
		// regex tests
		assert.equal('in this text 5replace999 numbers'.replaceAll(/[0-9]+/, 'FOO'), 'in this text FOOreplaceFOO numbers');
		assert.equal('in this text replace some characters with exclamation mark'.replaceAll(/[acg]/, '!'), 'in this text repl!!e some !h!r!!ters with ex!l!m!tion m!rk');
	});

	it('String.pad()', function () {
		// pad default
		assert.equal('pad right'.pad(15), 'pad right      ');
		assert.equal('pad right char'.pad(20, '0'), 'pad right char000000');
		assert.equal('pad right chars'.pad(20, 'ab'), 'pad right charsababa');
		// pad right
		assert.equal('pad right manual'.pad(20, '!', 'right'), 'pad right manual!!!!');
		assert.equal('pad right manual '.pad(20, '!', 'right'), 'pad right manual !!!');
		assert.equal('pad right manual '.pad(20, '!-', 'right'), 'pad right manual !-!');
		// pad left
		assert.equal('pad left'.pad(15, ' ', 'left'), '       pad left');
		assert.equal('pad left char'.pad(20, '0', 'left'), '0000000pad left char');
		assert.equal(' pad left chars'.pad(19, 'ab', 'left'), 'abab pad left chars');
		assert.equal(' pad left chars'.pad(20, 'ab', 'left'), 'ababa pad left chars');
		// pad center with one character
		assert.equal('a'.pad(1, '-', 'both'), 'a');
		assert.equal('a'.pad(2, '-', 'both'), '-a');
		assert.equal('a'.pad(3, '-', 'both'), '-a-');
		assert.equal('a'.pad(4, '-', 'both'), '--a-');
		// pad center with more characters
		assert.equal('a'.pad(1, '!-', 'both'), 'a');
		assert.equal('a'.pad(2, '!-', 'both'), '!a');
		assert.equal('a'.pad(3, '!-', 'both'), '!a!');
		assert.equal('a'.pad(4, '!-', 'both'), '!-a!');
		assert.equal('a'.pad(5, '!-', 'both'), '!-a!-');
		assert.equal('a'.pad(6, '!-', 'both'), '!-!a!-');
		assert.equal('a'.pad(7, '!-', 'both'), '!-!a!-!');
		assert.equal('pad center'.pad(20, '-', 'both'), '-----pad center-----');
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
		assert.equal('{0} is {2} and {1} is {2} too'.formatUnicorn('pldrGallery', 'author', 'cool'), result);
		assert.equal('{name1} is {what} and {name2} is {what} too'.formatUnicorn({'name1': 'pldrGallery', 'name2': 'author', 'what': 'cool'}), result);
		// non-string parameters
		assert.equal('change {0} this'.formatUnicorn(1), 'change 1 this');
		// dont change
		assert.equal('just print {0} zero'.formatUnicorn(), 'just print {0} zero');
		assert.equal('just print {1} one'.formatUnicorn(), 'just print {1} one');
		assert.equal('just print {} brackets'.formatUnicorn(), 'just print {} brackets');
		// parameters dont know what to replace
		assert.equal('dont change'.formatUnicorn('param1', 'param2'), 'dont change');
		assert.equal('dont change'.formatUnicorn({'bla': 'ble', 'foo': 'bar'}), 'dont change');
		assert.equal('dont change'.formatUnicorn(null), 'dont change');
		assert.equal('dont change'.formatUnicorn(1), 'dont change');
	});

	it('String.escapeRegex()', function () {
		// @TODO
	});

	it('String.escapeHtml()', function () {
		// @TODO
	});

	it('Array.last()', function () {
		assert.equal(['a'].last(), 'a');
		assert.equal(['a'].last(1), 'a');
		assert.equal(['a', 'b'].last(2), 'a');
		assert.equal(['a', 'b'].last(1), 'b');
		assert.deepStrictEqual([['a', 'b']].last(1), ['a', 'b']);
		assert.deepStrictEqual(['a', ['a', 'b']].last(1), ['a', 'b']);
		assert.deepStrictEqual(['a', ['a', 'b']].last(2), 'a');

		assert.equal([].last(), undefined);
		assert.equal([].last(1), undefined);
		assert.equal(['a'].last(2), undefined);
		// should throw error
		assert.throws(() => [].last(0));
	});

	it('Array.inArray()', function () {
		assert.equal(['a'].inArray('a'), true);
		assert.equal(['a', 'b'].inArray('a'), true);
		assert.equal(['a', 'b'].inArray('b'), true);
		assert.equal(['a', 1].inArray(1), true);

		assert.equal(['a'].inArray('c'), false);
		assert.equal(['a', 'b'].inArray('c'), false);
		assert.equal(['a', 'b'].inArray('c'), false);
		assert.equal(['a', 1].inArray('1'), false);
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
		assert.equal(formatBytes(0), '0 B');
		assert.equal(formatBytes(1), '1 B');
		assert.equal(formatBytes(1023), '1023 B');
		assert.equal(formatBytes(1024), '1 KB');
		assert.equal(formatBytes(1025), '1 KB');
		assert.equal(formatBytes(1025, 3), '1.001 KB');
		assert.equal(formatBytes(1500, 0), '1 KB');
		assert.equal(formatBytes(1500, 1), '1.5 KB');
		assert.equal(formatBytes(1500), '1.46 KB');
		assert.equal(formatBytes(1500, 2), '1.46 KB');
		assert.equal(formatBytes(9999999), '9.54 MB');
		assert.equal(formatBytes(9999999999), '9.31 GB');
		assert.equal(formatBytes(99999999999999), '90.95 TB');
		assert.equal(formatBytes(9999999999999999), '8.88 PB');
		assert.equal(formatBytes(9999999999999999999), '8.67 EB');
		assert.equal(formatBytes(99999999999999999999999), '84.7 ZB');
		assert.equal(formatBytes(9999999999999999999999999), '8.27 YB');
		assert.equal(formatBytes(1208925819614629174706176), '1 YB');
	});

	it('isNumeric()', function () {
		// true
		assert.equal(isNumeric(0), true);
		assert.equal(isNumeric('0'), true);
		assert.equal(isNumeric(-0), true);
		assert.equal(isNumeric('-0'), true);
		assert.equal(isNumeric(1), true);
		assert.equal(isNumeric('1'), true);
		assert.equal(isNumeric(-1), true);
		assert.equal(isNumeric('-1'), true);
		assert.equal(isNumeric(1.1), true);
		assert.equal(isNumeric('1.1'), true);
		assert.equal(isNumeric(-1.1), true);
		assert.equal(isNumeric('-1.1'), true);
		assert.equal(isNumeric(99999), true);
		assert.equal(isNumeric('99999'), true);
		// false
		assert.equal(isNumeric(''), false);
		assert.equal(isNumeric('some string'), false);
		assert.equal(isNumeric('some string 1'), false);
		assert.equal(isNumeric('1 some string 1'), false);
		assert.equal(isNumeric([1]), false);
		assert.equal(isNumeric([1, 5]), false);
		assert.equal(isNumeric({'1': 1}), false);
		assert.equal(isNumeric({'1': 1, '5': 1}), false);
		assert.equal(isNumeric({'1': '1', '5': '1'}), false);
		assert.equal(isNumeric(Infinity), false);
		assert.equal(isNumeric(-Infinity), false);
	});

	it('msToHuman()', function () {
		// all units
		assert.equal(msToHuman(503263836), '5d 19h 47m 43s 836ms');
		// exact times
		assert.equal(msToHuman(1), '1ms');
		assert.equal(msToHuman(1000), '1s');
		assert.equal(msToHuman(60000), '1m');
		assert.equal(msToHuman(3600000), '1h');
		assert.equal(msToHuman(86400000), '1d');
		// skipping some units
		assert.equal(msToHuman(3720000), '1h 2m'); // skipping seconds and miliseconds
		assert.equal(msToHuman(3720010), '1h 2m 10ms'); // skipping seconds
		assert.equal(msToHuman(3601000), '1h 1s'); // skipping minutes and miliseconds
		assert.equal(msToHuman(3600005), '1h 5ms'); // skipping minutes and seconds
		assert.equal(msToHuman(86400555), '1d 555ms'); // skipping hours, minutes and seconds
		assert.equal(msToHuman(86455555), '1d 55s 555ms'); // skipping hours and minutes
		assert.equal(msToHuman(86460555), '1d 1m 555ms'); // skipping hours and seconds
		// going higher and higher...
		assert.equal(msToHuman(0), '0ms');
		assert.equal(msToHuman(10), '10ms');
		assert.equal(msToHuman(100), '100ms');
		assert.equal(msToHuman(10000), '10s');
		assert.equal(msToHuman(10050), '10s 50ms');
		assert.equal(msToHuman(100000), '1m 40s');
		assert.equal(msToHuman(1000000), '16m 40s');
		assert.equal(msToHuman(10000000), '2h 46m 40s');
		assert.equal(msToHuman(100000000), '1d 3h 46m 40s');
		assert.equal(msToHuman(1000000000), '11d 13h 46m 40s');
		assert.equal(msToHuman(10000000000), '115d 17h 46m 40s');
		// throw errors
		assert.throws(() => msToHuman());
		assert.throws(() => msToHuman('11'));
		assert.throws(() => msToHuman('fdasfds'));
		assert.throws(() => msToHuman([0]));
	});

	it('humanToMs()', function () {
		assert.equal(humanToMs('0ms'), 0);
		assert.equal(humanToMs('5d 20h 19m 40s 173ms'), 505180173);
		// going higher and higher...
		assert.equal(humanToMs('1ms'), 1);
		assert.equal(humanToMs('1s'), 1000);
		assert.equal(humanToMs('1m'), 60000);
		assert.equal(humanToMs('1h'), 3600000);
		assert.equal(humanToMs('1d'), 86400000);
		// skipping some units
		assert.equal(humanToMs('1h 2m'), 3720000);
		assert.equal(humanToMs('1h 2m 10ms'), 3720010);
		assert.equal(humanToMs('1h 1s'), 3601000);
		assert.equal(humanToMs('1h 5ms'), 3600005);
		assert.equal(humanToMs('1d 555ms'), 86400555);
		assert.equal(humanToMs('1d 55s 555ms'), 86455555);
		assert.equal(humanToMs('1d 1m 555ms'), 86460555);
		// going higher and higher...
		assert.equal(humanToMs('0ms'), 0);
		assert.equal(humanToMs('10ms'), 10);
		assert.equal(humanToMs('100ms'), 100);
		assert.equal(humanToMs('10s'), 10000);
		assert.equal(humanToMs('10s 50ms'), 10050);
		assert.equal(humanToMs('1m 40s'), 100000);
		assert.equal(humanToMs('16m 40s'), 1000000);
		assert.equal(humanToMs('2h 46m 40s'), 10000000);
		assert.equal(humanToMs('1d 3h 46m 40s'), 100000000);
		assert.equal(humanToMs('11d 13h 46m 40s'), 1000000000);
		assert.equal(humanToMs('115d 17h 46m 40s'), 10000000000);

		// invalid values (subject to change, might throw error in the future)
		assert.equal(humanToMs('0fasfsd ms'), 0);
		assert.equal(humanToMs('fasfsd'), 0);
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
		assert.equal(generateGoBackPath('/folder1/'), '/');
		assert.equal(generateGoBackPath('/folder1/folder2/'), '/folder1/');
		assert.equal(generateGoBackPath('/folder1/folder2/folder3/'), '/folder1/folder2/');
		// throw errors
		assert.throws(() => generateGoBackPath('/'));
	});

	it('pathToUrl()', function () {
		assert.equal(pathToUrl('/'), '/');
		assert.equal(pathToUrl('/folder with spaces/'), '/folder+with+spaces/');
		assert.equal(pathToUrl('/folder+with+plus/'), '/folder\\+with\\+plus/');
		assert.equal(pathToUrl('/ěščřžýáíé/'), '/ěščřžýáíé/');
		assert.equal(pathToUrl('/+ěščřžýáíé/'), '/\\+ěščřžýáíé/');
		assert.equal(pathToUrl('+'), '\\+');
		assert.equal(pathToUrl('+bla'), '\\+bla');
		assert.equal(pathToUrl('bla+bla'), 'bla\\+bla');
		assert.equal(pathToUrl('bla+'), 'bla\\+');
		assert.equal(pathToUrl('/demo/folder with+spaces and+plus signs/'), '/demo/folder+with\\+spaces+and\\+plus+signs/');
	});

	it('pathFromUrl()', function () {
		assert.equal(pathFromUrl('/'), '/');
		assert.equal(pathFromUrl('/folder+with+spaces/'), '/folder with spaces/');
		assert.equal(pathFromUrl('/folder\\+with\\+plus/'), '/folder+with+plus/');
		assert.equal(pathFromUrl('/ěščřžýáíé/'), '/ěščřžýáíé/');
		assert.equal(pathFromUrl('/\\+ěščřžýáíé/'), '/+ěščřžýáíé/');
		assert.equal(pathFromUrl('\\+'), '+');
		assert.equal(pathFromUrl('\\+bla'), '+bla');
		assert.equal(pathFromUrl('bla\\+bla'), 'bla+bla');
		assert.equal(pathFromUrl('bla\\+'), 'bla+');
		assert.equal(pathFromUrl('/demo/folder+with\\+spaces+and\\+plus+signs/'), '/demo/folder with+spaces and+plus signs/');
	});

	it('copyToClipboard()', function () {
		// Can be tested only in browser
	});
});