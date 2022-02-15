class Coordinates {
	/**
	 * @param {number|string} lat Latitude
	 * @param {number|string} lon Longitude
	 */
	constructor(lat, lon) {
		this.lat = lat;
		this.lon = lon;
	}

	/** @returns {number} Get latitude */
	get lat() {
		return this._lat;
	}

	/** @returns {number} Get longitude */
	get lon() {
		return this._lon;
	}

	/** @param {number|string} lat Set latitude */
	set lat(lat) {
		if (Coordinates.isLat(lat)) {
			this._lat = parseFloat(lat);
		} else {
			throw new Error('Latitude coordinate must be numeric between or equal from -90 to 90 degrees.');
		}
	}

	/** @param {number|string} lon Set longitude */
	set lon(lon) {
		if (Coordinates.isLon(lon)) {
			this._lon = parseFloat(lon);
		} else {
			throw new Error('Longitude coordinate must be numeric between or equal from -180 to 180 degrees.');
		}
	}

	/** @returns {string} */
	toString() {
		return this._lat + ',' + this._lon;
	}

	/**
	 * Return coordinates as JSON.
	 *
	 * @example Output can be used as LatLng parameter to LeafletJS: https://leafletjs.com/reference.html#latlng
	 * const coords = new Coordinates(50.1, 14.4);
	 * map.panTo(coords.json());
	 *
	 * @returns {{lon: number, lat: number}}
	 **/
	json() {
		return {
			lat: this._lat,
			lon: this._lon,
		}
	}

	/**
	 * Check if input is valid latitude
	 *
	 * @param {number|string} lat
	 * @returns {boolean}
	 */
	static isLat(lat) {
		let latReal = null;
		if (typeof lat === 'number' || (typeof lat === 'string' && lat.match(/^-?[0-9]{1,2}\.[0-9]{1,99}$/))) {
			latReal = parseFloat(lat);
		} else {
			return false;
		}
		return latReal >= -90 && latReal <= 90;
	}

	/**
	 * Check if input is valid longitude
	 *
	 * @param {number|string} lon
	 * @returns {boolean}
	 */
	static isLon(lon) {
		let lonReal = null;
		if (typeof lon === 'number' || (typeof lon === 'string' && lon.match(/^-?[0-9]{1,3}\.[0-9]{1,99}$/))) {
			lonReal = parseFloat(lon);
		} else {
			return false;
		}
		return lonReal >= -180 && lonReal <= 180;
	}

	/**
	 * Create new instance but return null if lat and/or lon are invalid
	 *
	 * @param {number|string} lat Latitude
	 * @param {number|string} lon Longitude
	 * @returns {Coordinates|null}
	 */
	static safe(lat, lon) {
		try {
			return new Coordinates(lat, lon)
		} catch (error) {
			return null;
		}
	}
}

global = (typeof global === 'undefined') ? {} : global;
global.Coordinates = Coordinates;
