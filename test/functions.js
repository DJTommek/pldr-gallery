require('../public/js/functions.js');
const assert = require('assert');

describe('Functions', function() {
    it('String.replaceAll', function() {
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

    it('String.pad', function () {
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
        // @TODO testing invalid parameters (should throw error)
        // length parameter
        // 'string'.pad() // Error: Parameter "length" has to be positive number.
        // 'string'.pad(0) // Error: Parameter "length" has to be positive number.
        // 'string'.pad(-1) // Error: Parameter "length" has to be positive number.
        // 'string'.pad(null) // Error: Parameter "length" has to be positive number.
        // 'string'.pad('') // Error: Parameter "length" has to be positive number.
        // 'string'.pad({}) // Error: Parameter "length" has to be positive number.
        // string parameters
        // 'string'.pad(1, '') // Error: Parameter "string" has to be string of non-zero length
        // 'string'.pad(1, 1) // Error: Parameter "string" has to be string of non-zero length
        // 'string'.pad(1, null)  // Error: Parameter "string" has to be string of non-zero length
        // 'string'.pad(1, {}) // Error: Parameter "string" has to be string of non-zero length
        // 'string'.pad(1, /[0-9]/) // Error: Parameter "string" has to be string of non-zero length
        // type parameters
        // 'string'.pad(1, ' ', null) // Error: Parameter "type" has to be "left" or "right" or "both".
        // 'string'.pad(1, ' ', 'bla') // Error: Parameter "type" has to be "left" or "right" or "both".
        // 'string'.pad(1, ' ', 'LEFT') // Error: Parameter "type" has to be "left" or "right" or "both".
        // 'string'.pad(1, ' ', 'center') // Error: Parameter "type" has to be "left" or "right" or "both".
    });
});