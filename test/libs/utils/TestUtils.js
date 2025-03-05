const assert = require('assert');
const FSP = require('fs/promises');
const Utils = require('../../../src/libs/utils/utils.js');

describe('Utils', function () {
	describe('geojsonAverageCoordinate()', function () {
		it('Support for Feature of type MultiPolygon', async function () {
			const geojsonRaw = await FSP.readFile(__dirname + '/../../../demo/files/iiprague.geojson');
			const geojson = JSON.parse(geojsonRaw.toString());
			const center = Utils.geojsonAverageCoordinate(geojson);
			assert.strictEqual(center.lat, 50.063670624895565);
			assert.strictEqual(center.lon, 14.472393055579445);
		});
		it('Support for Feature of type LineString', async function () {
			const geojsonRaw = await FSP.readFile(__dirname + '/../../../demo/files/DJTommek 2025-02-14 KitzSki 83.9km.geojson');
			const geojson = JSON.parse(geojsonRaw.toString());
			const center = Utils.geojsonAverageCoordinate(geojson);
			assert.strictEqual(center.lat, 47.41335582693851);
			assert.strictEqual(center.lon, 12.341538043591783);
		});
	});
});
