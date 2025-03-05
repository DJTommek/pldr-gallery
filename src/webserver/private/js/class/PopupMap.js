class PopupMap extends AbstractMap {
	/**
	 * @param {string} elementId
	 */
	constructor(elementId) {
		super(elementId);

		this.bounds = null;
		this.defaultLayer = null;
		this._fileItem;
	}

	async init(fileItem) {
		const previousFileItem = this._fileItem;
		if (previousFileItem === fileItem) {
			return this; // Everything is already loaded, no need to do anything
		}
		this._fileItem = fileItem;

		if (!this.map) { // Initialize only once
			super.init();
		}

		if (this.defaultLayer) {
			this.defaultLayer.remove();
			this.defaultLayer = null;
		}

		this.defaultLayer = L.layerGroup().addTo(this.map);
		if (fileItem.ext === 'geojson') {
			await this._handleGeojson(fileItem);
		} else if (fileItem.ext === 'gpx') {
			await this._handleGpx(fileItem);
		} else {
			throw Error('Missing handler for map file item of extension "' + fileItem.ext + '"');
		}
		return this;
	}

	async _handleGeojson(fileItem) {
		const mapDataUrl = fileItem.getFileUrl(true);
		let geojsonData;
		let geojson;
		const response = await fetch(mapDataUrl);
		if (response.status !== 200) {
			throw new DomainError((await response.json()).message);
		}
		try {
			geojsonData = await response.json();
		} catch (error) {
			throw new DomainError('File content is not valid JSON');
		}
		try {
			geojson = L.geoJSON(geojsonData);
		} catch (error) {
			throw new DomainError('File content is not valid GeoJSON');
		}
		geojson.addTo(this.defaultLayer);
		this.bounds = geojson.getBounds();
	}

	async _handleGpx(fileItem) {
		const self = this;
		const url = fileItem.getFileUrl(true);
		const options = {
			async: true,
		};

		await new Promise(function (resolve, reject) {
			const gpx = new L.GPX(url, options);
			gpx.on('loaded', (event) => {
				self.bounds = event.target.getBounds();
				resolve();
			})
			gpx.on('error', reject);
			gpx.addTo(self.defaultLayer);
			setTimeout(function () {
				// @HACK When loading GPX fails eg because of file is not XML or missing some attributes, then library
				// will fail without emitting "error" event. This fail is also not catchable because it is happening in
				// external script. As of version 2.1.2, 2025-03-05.
				// As workaround, wait some time and then fail with general message.
				reject(new DomainError('Loading GPX file took too long.'));
			}, 5_000);
		});
	}
}
