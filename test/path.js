const pathCustom = require('../src/libs/path.js');
pathCustom.defineBaseDir(__dirname + '../');

const PATH = require('path');
const assert = require('assert');

describe('absoluteToRelative() method from path.js', function () {
	it('absoluteToRelative() for folders', function () {
		// UNIX
		assert.strictEqual(pathCustom.absoluteToRelative('/mnt/media/data/', '/mnt/media/data/'), '/');
		assert.strictEqual(pathCustom.absoluteToRelative('/mnt/media/data/', '/mnt/'), '/media/data/');
		assert.strictEqual(pathCustom.absoluteToRelative('/mnt/media/data/folder.png/', '/mnt/media/data/'), '/folder.png/');
		if (PATH.sep === '\\') { // will work only on Windows
			assert.strictEqual(pathCustom.absoluteToRelative('\\mnt\\media\\data\\', '\\mnt\\media\\data\\'), '/');
			assert.strictEqual(pathCustom.absoluteToRelative('\\mnt\\media\\data\\', '\\mnt\\'), '/media/data/');

			assert.strictEqual(pathCustom.absoluteToRelative('C:/mnt/media/data/', 'C:/mnt/media/data/'), '/');
			assert.strictEqual(pathCustom.absoluteToRelative('C:/mnt/media/data/', 'C:/mnt/'), '/media/data/');
			assert.strictEqual(pathCustom.absoluteToRelative('C:\\mnt\\media\\data\\', 'C:\\mnt\\media\\data\\'), '/');
			assert.strictEqual(pathCustom.absoluteToRelative('C:\\mnt\\media\\data\\', 'C:\\mnt\\'), '/media/data/');
			assert.strictEqual(pathCustom.absoluteToRelative('C:/mnt/media/data/folder.png/', 'C:/mnt/media/data/'), '/folder.png/');
			// mix of forward and backslash.. never ever do this!
			assert.strictEqual(pathCustom.absoluteToRelative('C:\\mnt/media\\data\\', 'C:\\mnt\\media/data\\'), '/');
			assert.strictEqual(pathCustom.absoluteToRelative('C:\\mnt\\media\\data/', 'C:\\mnt\\'), '/media/data/');
		}
	});
	it('absoluteToRelative() for files', function () {
		// UNIX
		assert.strictEqual(pathCustom.absoluteToRelative('/mnt/media/data/file.png', '/'), '/mnt/media/data/file.png');
		assert.strictEqual(pathCustom.absoluteToRelative('/mnt/media/data/file.png', '/mnt/'), '/media/data/file.png');
		assert.strictEqual(pathCustom.absoluteToRelative('/mnt/media/data/file.png', '/mnt/media/data/'), '/file.png');
		if (PATH.sep === '\\') { // will work only on Windows
			assert.strictEqual(pathCustom.absoluteToRelative('\\mnt\\media\\data\\file.png', '\\mnt\\'), '/media/data/file.png');
			assert.strictEqual(pathCustom.absoluteToRelative('\\mnt\\media\\data\\file.png', '\\mnt\\media\\data\\'), '/file.png');
			assert.strictEqual(pathCustom.absoluteToRelative('C:/mnt/media/file.png', 'C:/mnt/media/'), '/file.png');
			assert.strictEqual(pathCustom.absoluteToRelative('C:/mnt/media/file.png', 'C:/mnt/'), '/media/file.png');
			assert.strictEqual(pathCustom.absoluteToRelative('C:\\mnt\\media\\file.png', 'C:\\mnt\\media\\'), '/file.png');
			assert.strictEqual(pathCustom.absoluteToRelative('C:\\mnt\\media\\file.png', 'C:\\mnt\\'), '/media/file.png');
			// mix of forward and backslash.. never ever do this!
			assert.strictEqual(pathCustom.absoluteToRelative('C:\\mnt/media\\file.png', 'C:\\mnt\\media/'), '/file.png');
			assert.strictEqual(pathCustom.absoluteToRelative('C:\\mnt\\media/file.png', 'C:\\mnt\\'), '/media/file.png');
		}
	});
});

describe('relativeToAbsolute() method from path.js', function () {
	it('relativeToAbsolute() for folders', function () {
		// UNIX
		assert.strictEqual(pathCustom.relativeToAbsolute('/', '/'), '/');
		assert.strictEqual(pathCustom.relativeToAbsolute('/test/', '/mnt/media/data/'), '/mnt/media/data/test/');
		assert.strictEqual(pathCustom.relativeToAbsolute('/test1/test2/', '/mnt/media/data/'), '/mnt/media/data/test1/test2/');
		if (PATH.sep === '\\') { // will work only on Windows
			assert.strictEqual(pathCustom.relativeToAbsolute('/', '\\'), '/');
			assert.strictEqual(pathCustom.relativeToAbsolute('/test/', '\\mnt\\media\\data\\'), '/mnt/media/data/test/');
			assert.strictEqual(pathCustom.relativeToAbsolute('/test1/test2/', '\\mnt\\media\\data\\'), '/mnt/media/data/test1/test2/');
			// Windows
			assert.strictEqual(pathCustom.relativeToAbsolute('/', 'C:/'), 'C:/');
			assert.strictEqual(pathCustom.relativeToAbsolute('/test/', 'C:/mnt/media/data/'), 'C:/mnt/media/data/test/');
			assert.strictEqual(pathCustom.relativeToAbsolute('/test1/test2/', 'C:/mnt/media/data/'), 'C:/mnt/media/data/test1/test2/');
			assert.strictEqual(pathCustom.relativeToAbsolute('/', 'C:\\'), 'C:/');
			assert.strictEqual(pathCustom.relativeToAbsolute('/test/', 'C:\\mnt\\media\\data\\'), 'C:/mnt/media/data/test/');
			assert.strictEqual(pathCustom.relativeToAbsolute('/test1/test2/', 'C:\\mnt\\media\\data\\'), 'C:/mnt/media/data/test1/test2/');
		}
	});
	it('relativeToAbsolute() for files', function () {
		// UNIX
		assert.strictEqual(pathCustom.relativeToAbsolute('/file.mp4', '/'), '/file.mp4');
		assert.strictEqual(pathCustom.relativeToAbsolute('/test/file.mp4', '/mnt/media/data/'), '/mnt/media/data/test/file.mp4');
		assert.strictEqual(pathCustom.relativeToAbsolute('/test1/test2/file.mp4', '/mnt/media/data/'), '/mnt/media/data/test1/test2/file.mp4');
		if (PATH.sep === '\\') { // will work only on Windows
			assert.strictEqual(pathCustom.relativeToAbsolute('/file.mp4', '\\'), '/file.mp4');
			assert.strictEqual(pathCustom.relativeToAbsolute('/test/file.mp4', '\\mnt\\media\\data\\'), '/mnt/media/data/test/file.mp4');
			assert.strictEqual(pathCustom.relativeToAbsolute('/test1/test2/file.mp4', '\\mnt\\media\\data\\'), '/mnt/media/data/test1/test2/file.mp4');
			// Windows
			assert.strictEqual(pathCustom.relativeToAbsolute('/file.mp4', 'C:/'), 'C:/file.mp4');
			assert.strictEqual(pathCustom.relativeToAbsolute('/test/file.mp4', 'C:/mnt/media/data/'), 'C:/mnt/media/data/test/file.mp4');
			assert.strictEqual(pathCustom.relativeToAbsolute('/test1/test2/file.mp4', 'C:/mnt/media/data/'), 'C:/mnt/media/data/test1/test2/file.mp4');
			assert.strictEqual(pathCustom.relativeToAbsolute('/file.mp4', 'C:\\'), 'C:/file.mp4');
			assert.strictEqual(pathCustom.relativeToAbsolute('/test/file.mp4', 'C:\\mnt\\media\\data\\'), 'C:/mnt/media/data/test/file.mp4');
			assert.strictEqual(pathCustom.relativeToAbsolute('/test1/test2/file.mp4', 'C:\\mnt\\media\\data\\'), 'C:/mnt/media/data/test1/test2/file.mp4');
			// mix of forward and backslash.. never ever do this!
			assert.strictEqual(pathCustom.relativeToAbsolute('/test1\\test2/file.mp4', 'C:/mnt\\media/data/'), 'C:/mnt/media/data/test1/test2/file.mp4');
			assert.strictEqual(pathCustom.relativeToAbsolute('/test1/test2\\file.mp4', 'C:\\mnt/media\\data\\'), 'C:/mnt/media/data/test1/test2/file.mp4');
		}
	});
});

describe('Test extname() method from path.js', function () {
	it('extname()', function () {
		assert.strictEqual(pathCustom.extname('file.png'), 'png');
		assert.strictEqual(pathCustom.extname('file.PnG'), 'png');
		assert.strictEqual(pathCustom.extname('/file.png'), 'png');
		assert.strictEqual(pathCustom.extname('/file.pNG'), 'png');
		assert.strictEqual(pathCustom.extname('/some/file.png'), 'png');
		assert.strictEqual(pathCustom.extname('file.png.sync'), 'sync');
		assert.strictEqual(pathCustom.extname('/file.png.sync'), 'sync');
		assert.strictEqual(pathCustom.extname('/some/file.png.sync'), 'sync');
		assert.strictEqual(pathCustom.extname('/some/FILE.png.sync'), 'sync');
		assert.strictEqual(pathCustom.extname('/some/FILE.PNG.SYNC'), 'sync');
		assert.strictEqual(pathCustom.extname('/test/folder'), '');
		assert.strictEqual(pathCustom.extname('/test/FOLDER'), '');
	});
});

describe('Test join() method from path.js', function () {
	it('join()', function () {
		assert.strictEqual(pathCustom.join('/'), '/');
		assert.strictEqual(pathCustom.join('/mnt/'), '/mnt/');
		assert.strictEqual(pathCustom.join('/mnt'), '/mnt');

		assert.strictEqual(pathCustom.join('folder1', 'folder2'), 'folder1/folder2');
		assert.strictEqual(pathCustom.join('/mnt', '/'), '/mnt/');
		assert.strictEqual(pathCustom.join('/mnt/', '/'), '/mnt/');
		assert.strictEqual(pathCustom.join('/', '/mnt'), '/mnt');
		assert.strictEqual(pathCustom.join('/', '/mnt/'), '/mnt/');
		assert.strictEqual(pathCustom.join('/', 'mnt/'), '/mnt/');
		assert.strictEqual(pathCustom.join('/', 'mnt'), '/mnt');

		assert.strictEqual(pathCustom.join('/mnt/media', 'bla'), '/mnt/media/bla');
		assert.strictEqual(pathCustom.join('folder1', 'folder2', 'folder3'), 'folder1/folder2/folder3');

		assert.strictEqual(pathCustom.join('/', '/'), '/');
		assert.strictEqual(pathCustom.join('////', '/'), '/');
		assert.strictEqual(pathCustom.join('/', '////'), '/');
		assert.strictEqual(pathCustom.join('////', '////'), '/');
	});
});

describe('Test dirname() method from path.js', function () {
	it('dirname()', function () {
		// file
		assert.strictEqual(pathCustom.dirname('/hello.png'), '/');
		assert.strictEqual(pathCustom.dirname('/some/hello.png'), '/some/');
		assert.strictEqual(pathCustom.dirname('/some/hello/hello.png'), '/some/hello/');
		// folder
		assert.strictEqual(pathCustom.dirname('/'), '/');
		// folder without trailing slash
		assert.strictEqual(pathCustom.dirname('/test'), '/');
		assert.strictEqual(pathCustom.dirname('/test/bla'), '/test/');
		assert.strictEqual(pathCustom.dirname('test/bla'), 'test/');
		assert.strictEqual(pathCustom.dirname('test/bla.png'), 'test/');
		// folder with trailing slash
		assert.strictEqual(pathCustom.dirname('/mnt/'), '/');
		assert.strictEqual(pathCustom.dirname('/mnt bla/'), '/');
		assert.strictEqual(pathCustom.dirname('/mnt bla/image.png/'), '/mnt bla/');
		assert.strictEqual(pathCustom.dirname('/mnt bla/image.png/image.png'), '/mnt bla/image.png/');
	});
});
