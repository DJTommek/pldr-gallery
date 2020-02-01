require('../public/js/functions.js');
const assert = require('assert');

describe('Test all functions from functions.js', function() {
    it('String.replaceAll()', function() {
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
        // pad default (right)
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
        // @TODO
    });

    it('msToHuman()', function () {
        // @TODO
    });

    it('humanToMs()', function () {
        // @TODO
    });

    it('convertDMSToDD()', function () {
        // @TODO
    });

    it('sanatizePath()', function () {
        // @TODO
    });

    it('generateGoBackPath()', function () {
        // @TODO
    });

    it('pathToUrl()', function () {
        // @TODO
    });

    it('pathFromUrl()', function () {
        // @TODO
    });

    it('copyToClipboard()', function () {
        // Can be tested only in browser
        // @TODO
    });
});