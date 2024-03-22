/*!
 * Abstract map
 * @abstract
 */
class AbstractMap {
	defaultCoords = new Coordinates(49.6, 15.2); // Czechia
	defaultZoom = 7;

	constructor(elementId) {
		if (this.constructor == AbstractMap) {
			throw new Error('Abstract classes cannot be instantiated.');
		}
		this.elementId = elementId;
		this.element = null; // filled upon init
		this.map = null;
		this.markers = {};

		this.tileLayers = {
			'OSM default': L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
				maxZoom: 19,
				attribution: 'copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			}),
			'Mapy.cz hiking': L.tileLayer('https://mapserver.mapy.cz/turist-m/{z}-{x}-{y}', {
				minZoom: 2,
				maxZoom: 18,
				attribution: '<a href="https://o.seznam.cz" target="_blank" rel="noopener">Seznam.cz, a.s.</a>',
				tileSize: 256,
				zoomOffset: 0,
			}),
		};
		this.overlays = {
			'Default': L.layerGroup([]),
			'Clustered': L.markerClusterGroup(),
		};
	}

	init() {
		this.element = document.getElementById(this.elementId);
		this.map = L.map(this.element, {
			fullscreenControl: true,
		}).setView(this.defaultCoords, this.defaultZoom);
		L.control.layers(this.tileLayers, this.overlays).addTo(this.map);
		this.tileLayers['OSM default'].addTo(this.map); // Default layer to be displayed on page load
		this.overlays['Clustered'].addTo(this.map);
		return this;
	}

	getMarker(uniqueId) {
		return this.markers[uniqueId];
	}

	mapShow() {
		this.element.style.display = 'block';
		this.map.invalidateSize();
	}

	mapHide() {
		this.element.style.display = 'none';
	}
}
