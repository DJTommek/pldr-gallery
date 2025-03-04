/*!
 * Abstract map
 * @abstract
 */
class AbstractMap {
	defaultCoords = new Coordinates(49.6, 15.2); // Czechia
	defaultZoom = 7;

	/**
	 * @TODO Rewrite to require element instance instead of element ID (to support HTML elements without IDs)
	 */
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
				attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			}),
		};
		this.overlays = {
			'Default': L.layerGroup([]),
			'Clustered': L.markerClusterGroup(),
		};
	}

	init() {
		const self = this;

		this.element = document.getElementById(this.elementId);
		this.map = L.map(this.element, {
			fullscreenControl: true,
		}).setView(this.defaultCoords, this.defaultZoom);
		L.control.layers(this.tileLayers, this.overlays).addTo(this.map);
		this.tileLayers['OSM default'].addTo(this.map); // Default layer to be displayed on page load

		if (Settings.load('mapPathItemDisplayType') === 'default') {
			this.overlays['Default'].addTo(this.map);
		} else {
			this.overlays['Clustered'].addTo(this.map);
		}

		const locateControl = L.control.locate({
			setView: false,
			strings: {
				popup: function (params) {
					const marker = locateControl._marker;
					if (!marker) {
						return;
					}
					const markerLatLng = marker.getLatLng();
					const latLon = markerLatLng.lat.toFixed(6) + ',' + markerLatLng.lng.toFixed(6);
					return '<p>Location: <b><a href="https://better-location.palider.cz/' + latLon + '" target="_blank">' + latLon + '</a></b> (accuracy <b>' + formatDistance(parseInt(params.distance)) + '</b>)</p>';
				}
			}
		}).addTo(this.map);

		// If access to browser location is granted, show it in the map automatically but without pan and zoom
		navigator.permissions.query({
			name: 'geolocation',
		}).then(function (result) {
			if (result.state === 'granted') {
				locateControl.start();
			}
		});

		this.map.on('layeradd', function (event) {
			if (event.layer === self.overlays['Default']) {
				Settings.save('mapPathItemDisplayType', 'default');
			} else if (event.layer === self.overlays['Clustered']) {
				Settings.save('mapPathItemDisplayType', 'clustered');
			}
		});

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

	isHidden() {
		return this.element.style.display === 'none';
	}
}
