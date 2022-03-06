/*!
 * Structure map
 */
class AdvancedSearchMap {

	defaultCoords = new Coordinates(49.6, 15.2); // Czechia
	defaultZoom = 7;

	constructor(elementId) {
		this.elementId = elementId;
		this.element = null; // filled upon init
		this.map = null;
		this.pickedLocationMarker = null;

		this.tileLayers = {
			'OSM default': L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', {
				attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors, Imagery © <a href="https://www.mapbox.com/" target="_blank">Mapbox</a>',
				maxZoom: 22,
				minZoom: 1,
				id: 'mapbox/streets-v11',
				tileSize: 512,
				zoomOffset: -1,
				// @TODO change access_token (this is taken from from example on https://leafletjs.com/examples/quick-start/)
				accessToken: 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw'
			}),
			'Mapy.cz hiking': L.tileLayer('https://mapserver.mapy.cz/turist-m/{z}-{x}-{y}', {
				minZoom: 2,
				maxZoom: 18,
				attribution: '<a href="https://o.seznam.cz" target="_blank" rel="noopener">Seznam.cz, a.s.</a>',
				tileSize: 256,
				zoomOffset: 0,
			}),
		};
	}

	init() {
		this.element = document.getElementById(this.elementId);
		this.map = L.map(this.element, {
			fullscreenControl: true,
		}).setView(this.defaultCoords, this.defaultZoom);
		L.control.layers(this.tileLayers).addTo(this.map);
		this.tileLayers['OSM default'].addTo(this.map); // Default layer to be displayed on page load
		return this;
	}

	setMarker(latlng) {
		if (this.pickedLocationMarker === null) {
			this.pickedLocationMarker = L.marker(latlng).addTo(this.map);
		} else {
			this.pickedLocationMarker.setLatLng(latlng);
		}
	}

	mapShow() {
		this.element.style.display = 'block';
		this.map.invalidateSize();
	}

	mapHide() {
		this.element.style.display = 'none';
	}
}
