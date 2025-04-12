const assert = require('assert');
const FSP = require('fs/promises');
const Utils = require('../../../src/libs/utils/utils.js');
const {XMLParser} = require('fast-xml-parser');

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
	describe('gpxAverageCoordinate()', function () {
		const dataProvider = {
			'One waypoint example from Wikipedia': ['sample-wiki-waypoint-single.gpx', 52.518611, 13.376111],
			'Multiple waypoints example from Wikipedia': ['sample-wiki-waypoint-multiple.gpx', 49.224413999999996, 12.392786333333333],
			'Support for track exported from mapy.com': ['Drawing code.gpx', 50.076172366081906, 14.450758892397653],
			'Support for track exported from relive.cc': ['DJTommek 2025-02-13 Wildkogel 91.5km.gpx', 47.28594167387841, 12.293476082197232],
		};

		for (const [key, data] of Object.entries(dataProvider)) {
			const [filename, expectedLat, expectedLon] = data;
			it(key, async function () {
				const xmlParser = new XMLParser({ignoreAttributes: false});
				const xmlRaw = await FSP.readFile(__dirname + '/../../../demo/files/' + filename);
				const xml = xmlParser.parse(xmlRaw);
				const center = Utils.gpxAverageCoordinate(xml);
				assert.strictEqual(center.lat, expectedLat);
				assert.strictEqual(center.lon, expectedLon);
			});
		}
	});
});
