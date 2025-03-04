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
		return this;
	}
}
