class Coordinates {
	constructor(lat, lon) {
		if (Coordinates.isLat(lat) === false) {
			console.log(lat);
			throw new Error('Latitude coordinate must be numeric between or equal from -90 to 90 degrees.');
		}
		if (Coordinates.isLon(lon) === false) {
			console.log(lon);
			throw new Error('Longitude coordinate must be numeric between or equal from -180 to 180 degrees.');
		}
		this.lat = lat;
		this.lon = lon;
	}

	toString() {
		return this.lat + ',' + this.lon;
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
	 * Check if input is valid latitude
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
}

global = (typeof global === 'undefined') ? {} : global;
global.Coordinates = Coordinates;
