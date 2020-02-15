const pathCustom = require('../libs/path.js');
pathCustom.defineBaseDir(__dirname + '../');

const PATH = require('path');
const assert = require('assert');

describe('absoluteToRelative() method from path.js', function () {
	it('absoluteToRelative() for folders', function () {
		// UNIX
		assert.equal(pathCustom.absoluteToRelative('/mnt/media/data/', '/mnt/media/data/'), '/');
		assert.equal(pathCustom.absoluteToRelative('/mnt/media/data/', '/mnt/'), '/media/data/');
		assert.equal(pathCustom.absoluteToRelative('/mnt/media/data/folder.png/', '/mnt/media/data/'), '/folder.png/');
		if (PATH.sep === '\\') { // will work only on Windows
			assert.equal(pathCustom.absoluteToRelative('\\mnt\\media\\data\\', '\\mnt\\media\\data\\'), '/');
			assert.equal(pathCustom.absoluteToRelative('\\mnt\\media\\data\\', '\\mnt\\'), '/media/data/');

			assert.equal(pathCustom.absoluteToRelative('C:/mnt/media/data/', 'C:/mnt/media/data/'), '/');
			assert.equal(pathCustom.absoluteToRelative('C:/mnt/media/data/', 'C:/mnt/'), '/media/data/');
			assert.equal(pathCustom.absoluteToRelative('C:\\mnt\\media\\data\\', 'C:\\mnt\\media\\data\\'), '/');
			assert.equal(pathCustom.absoluteToRelative('C:\\mnt\\media\\data\\', 'C:\\mnt\\'), '/media/data/');
			assert.equal(pathCustom.absoluteToRelative('C:/mnt/media/data/folder.png/', 'C:/mnt/media/data/'), '/folder.png/');
			// mix of forward and backslash.. never ever do this!
			assert.equal(pathCustom.absoluteToRelative('C:\\mnt/media\\data\\', 'C:\\mnt\\media/data\\'), '/');
			assert.equal(pathCustom.absoluteToRelative('C:\\mnt\\media\\data/', 'C:\\mnt\\'), '/media/data/');
		}
	});
	it('absoluteToRelative() for files', function () {
		// UNIX
		assert.equal(pathCustom.absoluteToRelative('/mnt/media/data/file.png', '/'), '/mnt/media/data/file.png');
		assert.equal(pathCustom.absoluteToRelative('/mnt/media/data/file.png', '/mnt/'), '/media/data/file.png');
		assert.equal(pathCustom.absoluteToRelative('/mnt/media/data/file.png', '/mnt/media/data/'), '/file.png');
		if (PATH.sep === '\\') { // will work only on Windows
			assert.equal(pathCustom.absoluteToRelative('\\mnt\\media\\data\\file.png', '\\mnt\\'), '/media/data/file.png');
			assert.equal(pathCustom.absoluteToRelative('\\mnt\\media\\data\\file.png', '\\mnt\\media\\data\\'), '/file.png');
			assert.equal(pathCustom.absoluteToRelative('C:/mnt/media/file.png', 'C:/mnt/media/'), '/file.png');
			assert.equal(pathCustom.absoluteToRelative('C:/mnt/media/file.png', 'C:/mnt/'), '/media/file.png');
			assert.equal(pathCustom.absoluteToRelative('C:\\mnt\\media\\file.png', 'C:\\mnt\\media\\'), '/file.png');
			assert.equal(pathCustom.absoluteToRelative('C:\\mnt\\media\\file.png', 'C:\\mnt\\'), '/media/file.png');
			// mix of forward and backslash.. never ever do this!
			assert.equal(pathCustom.absoluteToRelative('C:\\mnt/media\\file.png', 'C:\\mnt\\media/'), '/file.png');
			assert.equal(pathCustom.absoluteToRelative('C:\\mnt\\media/file.png', 'C:\\mnt\\'), '/media/file.png');
		}
	});
});

describe('relativeToAbsolute() method from path.js', function () {
	it('relativeToAbsolute() for folders', function () {
		// UNIX
		assert.equal(pathCustom.relativeToAbsolute('/', '/'), '/');
		assert.equal(pathCustom.relativeToAbsolute('/test/', '/mnt/media/data/'), '/mnt/media/data/test/');
		assert.equal(pathCustom.relativeToAbsolute('/test1/test2/', '/mnt/media/data/'), '/mnt/media/data/test1/test2/');
		if (PATH.sep === '\\') { // will work only on Windows
			assert.equal(pathCustom.relativeToAbsolute('/', '\\'), '/');
			assert.equal(pathCustom.relativeToAbsolute('/test/', '\\mnt\\media\\data\\'), '/mnt/media/data/test/');
			assert.equal(pathCustom.relativeToAbsolute('/test1/test2/', '\\mnt\\media\\data\\'), '/mnt/media/data/test1/test2/');
			// Windows
			assert.equal(pathCustom.relativeToAbsolute('/', 'C:/'), 'C:/');
			assert.equal(pathCustom.relativeToAbsolute('/test/', 'C:/mnt/media/data/'), 'C:/mnt/media/data/test/');
			assert.equal(pathCustom.relativeToAbsolute('/test1/test2/', 'C:/mnt/media/data/'), 'C:/mnt/media/data/test1/test2/');
			assert.equal(pathCustom.relativeToAbsolute('/', 'C:\\'), 'C:/');
			assert.equal(pathCustom.relativeToAbsolute('/test/', 'C:\\mnt\\media\\data\\'), 'C:/mnt/media/data/test/');
			assert.equal(pathCustom.relativeToAbsolute('/test1/test2/', 'C:\\mnt\\media\\data\\'), 'C:/mnt/media/data/test1/test2/');
		}
	});
	it('relativeToAbsolute() for files', function () {
		// UNIX
		assert.equal(pathCustom.relativeToAbsolute('/file.mp4', '/'), '/file.mp4');
		assert.equal(pathCustom.relativeToAbsolute('/test/file.mp4', '/mnt/media/data/'), '/mnt/media/data/test/file.mp4');
		assert.equal(pathCustom.relativeToAbsolute('/test1/test2/file.mp4', '/mnt/media/data/'), '/mnt/media/data/test1/test2/file.mp4');
		if (PATH.sep === '\\') { // will work only on Windows
			assert.equal(pathCustom.relativeToAbsolute('/file.mp4', '\\'), '/file.mp4');
			assert.equal(pathCustom.relativeToAbsolute('/test/file.mp4', '\\mnt\\media\\data\\'), '/mnt/media/data/test/file.mp4');
			assert.equal(pathCustom.relativeToAbsolute('/test1/test2/file.mp4', '\\mnt\\media\\data\\'), '/mnt/media/data/test1/test2/file.mp4');
			// Windows
			assert.equal(pathCustom.relativeToAbsolute('/file.mp4', 'C:/'), 'C:/file.mp4');
			assert.equal(pathCustom.relativeToAbsolute('/test/file.mp4', 'C:/mnt/media/data/'), 'C:/mnt/media/data/test/file.mp4');
			assert.equal(pathCustom.relativeToAbsolute('/test1/test2/file.mp4', 'C:/mnt/media/data/'), 'C:/mnt/media/data/test1/test2/file.mp4');
			assert.equal(pathCustom.relativeToAbsolute('/file.mp4', 'C:\\'), 'C:/file.mp4');
			assert.equal(pathCustom.relativeToAbsolute('/test/file.mp4', 'C:\\mnt\\media\\data\\'), 'C:/mnt/media/data/test/file.mp4');
			assert.equal(pathCustom.relativeToAbsolute('/test1/test2/file.mp4', 'C:\\mnt\\media\\data\\'), 'C:/mnt/media/data/test1/test2/file.mp4');
			// mix of forward and backslash.. never ever do this!
			assert.equal(pathCustom.relativeToAbsolute('/test1\\test2/file.mp4', 'C:/mnt\\media/data/'), 'C:/mnt/media/data/test1/test2/file.mp4');
			assert.equal(pathCustom.relativeToAbsolute('/test1/test2\\file.mp4', 'C:\\mnt/media\\data\\'), 'C:/mnt/media/data/test1/test2/file.mp4');
		}
	});
});

describe('Test extname() method from path.js', function () {
	it('extname()', function () {
		assert.equal(pathCustom.extname('file.png'), 'png');
		assert.equal(pathCustom.extname('file.PnG'), 'png');
		assert.equal(pathCustom.extname('/file.png'), 'png');
		assert.equal(pathCustom.extname('/file.pNG'), 'png');
		assert.equal(pathCustom.extname('/some/file.png'), 'png');
		assert.equal(pathCustom.extname('file.png.sync'), 'sync');
		assert.equal(pathCustom.extname('/file.png.sync'), 'sync');
		assert.equal(pathCustom.extname('/some/file.png.sync'), 'sync');
		assert.equal(pathCustom.extname('/some/FILE.png.sync'), 'sync');
		assert.equal(pathCustom.extname('/some/FILE.PNG.SYNC'), 'sync');
		assert.equal(pathCustom.extname('/test/folder'), '');
		assert.equal(pathCustom.extname('/test/FOLDER'), '');
	});
});

describe('Test join() method from path.js', function () {
	it('join()', function () {
		assert.equal(pathCustom.join('/'), '/');
		assert.equal(pathCustom.join('/mnt/'), '/mnt/');
		assert.equal(pathCustom.join('/mnt'), '/mnt');

		assert.equal(pathCustom.join('folder1', 'folder2'), 'folder1/folder2');
		assert.equal(pathCustom.join('/mnt', '/'), '/mnt/');
		assert.equal(pathCustom.join('/mnt/', '/'), '/mnt/');
		assert.equal(pathCustom.join('/', '/mnt'), '/mnt');
		assert.equal(pathCustom.join('/', '/mnt/'), '/mnt/');
		assert.equal(pathCustom.join('/', 'mnt/'), '/mnt/');
		assert.equal(pathCustom.join('/', 'mnt'), '/mnt');

		assert.equal(pathCustom.join('/mnt/media', 'bla'), '/mnt/media/bla');
		assert.equal(pathCustom.join('folder1', 'folder2', 'folder3'), 'folder1/folder2/folder3');

		assert.equal(pathCustom.join('/', '/'), '/');
		assert.equal(pathCustom.join('////', '/'), '/');
		assert.equal(pathCustom.join('/', '////'), '/');
		assert.equal(pathCustom.join('////', '////'), '/');
	});
});

describe('Test dirname() method from path.js', function () {
	it('dirname()', function () {
		// file
		assert.equal(pathCustom.dirname('/hello.png'), '/');
		assert.equal(pathCustom.dirname('/some/hello.png'), '/some/');
		assert.equal(pathCustom.dirname('/some/hello/hello.png'), '/some/hello/');
		// folder
		assert.equal(pathCustom.dirname('/'), '/');
		// folder without trailing slash
		assert.equal(pathCustom.dirname('/test'), '/');
		assert.equal(pathCustom.dirname('/test/bla'), '/test/');
		assert.equal(pathCustom.dirname('test/bla'), 'test/');
		assert.equal(pathCustom.dirname('test/bla.png'), 'test/');
		// folder with trailing slash
		assert.equal(pathCustom.dirname('/mnt/'), '/');
		assert.equal(pathCustom.dirname('/mnt bla/'), '/');
		assert.equal(pathCustom.dirname('/mnt bla/image.png/'), '/mnt bla/');
		assert.equal(pathCustom.dirname('/mnt bla/image.png/image.png'), '/mnt bla/image.png/');
	});
});
