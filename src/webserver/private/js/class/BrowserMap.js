/*!
 * Map to browser photos available in given bounding box
 */
class BrowserMap extends AbstractStructureMap {

	/**
	 * @param {string} elementId
	 * @param {Structure} structure
	 * @param {ServerApi} serverApi
	 */
	constructor(elementId, structure, serverApi) {
		super(elementId, structure);

		this.structure = structure;
		this.serverApi = serverApi;

		this._previousRequestParams = null;
	}

	init() {
		const self = this;

		super.init();

		this._initLoadingDataInfo();

		this.loadingInfoLoading = document.querySelector('.browser-map-loading-info .loading');
		this.loadingInfoText = document.querySelector('.browser-map-loading-info .text');

		return this;
	}

	/**
	 * @param {FolderItem} directoryItem
	 */
	async loadData(directoryItem) {
		try {
			this.loadingInfoLoading.style.display = 'block';
			this.loadingInfoText.style.display = 'none';
			await this._loadDataInner(directoryItem);
		} catch (error) {
			const errorMsg = (error.message || 'Unknown error, try again later.');
			flashMessage('Error while loading map data: ' + errorMsg, 'danger');
			this.loadingInfoText.innerText = 'Error: ' + errorMsg;
		} finally {
			this.loadingInfoLoading.style.display = 'none';
			this.loadingInfoText.style.display = 'block';
		}
	}

	/**
	 * Load data for map from API and parse it into the map.
	 *
	 * @param {FolderItem} directoryItem
	 * @return {Promise<void>}
	 */
	async _loadDataInner(directoryItem) {
		const mapBounds = this.map.getBounds();
		const mapBoundsCenter = mapBounds.getCenter();

		const params = new URLSearchParams();
		params.set('path', directoryItem.getEncodedPath());
		params.set('lat', mapBoundsCenter.lat);
		params.set('lon', mapBoundsCenter.lng);
		params.set('limit', '500');
		params.set('sort', 'distance');
		params.set('boundingBox', [mapBounds.getWest(), mapBounds.getSouth(), mapBounds.getEast(), mapBounds.getNorth()].join(','));

		const paramsString = params.toString();
		if (this._previousRequestParams === paramsString) {
			console.log('[BrowserMap] Exactly same search request was already executed last time, cancelling.');
			return;
		}
		this._previousRequestParams = paramsString;

		let result;
		try {
			result = await this.serverApi.search(params);
		} catch (error) {
			flashMessage(`Searching in <b>${directoryItem.path.escapeHtml()}</b> failed:<br>${error.message.escapeHtml()}`, 'danger', false);
			return;
		}

		// Previously loaded map elements
		let mapElementIdsToRemove = Object.keys(this.mapElements);

		let index = 0;
		for (const fileRaw of result.result.files) {
			const fileItem = new FileItem(index++, fileRaw)
			const mapElementId = this.generateMapElementId(fileItem);
			if (mapElementId in this.mapElements) { // This item is already rendered in the map
				mapElementIdsToRemove = mapElementIdsToRemove.filter((value) => value !== mapElementId)
				continue;
			}

			if (fileItem.isMap) {
				try {
					if (fileItem.ext === 'geojson') {
						const response = await fetch(fileItem.getFileUrl(true));
						const geoJsonData = await response.json();
						const geojsonLayer = L.geoJSON(geoJsonData);
						this.mapElements[mapElementId] = geojsonLayer;
						geojsonLayer.addTo(this.overlays['Tracks']);
					} else if (fileItem.ext === 'gpx') {
						const options = {
							async: true,
							markers: {
								startIcon: null,
								endIcon: null,
							},
						};
						const gpx = new L.GPX(fileItem.getFileUrl(true), options);
						this.mapElements[mapElementId] = gpx;
						gpx.addTo(this.overlays['Tracks']);
					}
				} catch (error) {
					console.error('Unable to load and process geojson of "' + fileItem + '":', error);
				}
			} else {
				this.addMarker(mapElementId, fileItem, this.fileItemPopupContent(fileItem, false))
			}
		}

		for (const mapElementId of mapElementIdsToRemove) {
			const mapElement = this.getMapElement(mapElementId);

			if (
				typeof mapElement.getBounds === 'function'
				&& this.map.getBounds().intersects(mapElement.getBounds())
			) {
				continue; // Do not remove element if element's bounds are still in bounds of map viewport.
			}

			this.removeMapElement(mapElementId);
		}
		this.loadingInfoText.innerText = result.message;

		loadThumbnail();
	}


	/**
	 * Create and initialize control to show status of loading map data.
	 */
	_initLoadingDataInfo() {
		this.div = null;

		L.Control.loadingDataInfo = this.loadingDataInfoControl = L.Control.extend({
			onAdd: function (map) {
				// Create control button
				this.div = L.DomUtil.create('div');
				this.div.classList.add('leaflet-bar', 'leaflet-control', 'browser-map-loading-info');
				this.div.innerHTML = '<div>' +
					'<span class="loading" style="display: none"><i class="fa fa-circle-o-notch fa-spin"></i> Loading...</span>' +
					'<span class="text" style="display: none"></span>' +
					'</div>';

				return this.div;
			},
		});

		L.control.loadingDataInfo = function (opts) {
			return new L.Control.loadingDataInfo(opts);
		}

		L.control.loadingDataInfo({position: 'bottomright'}).addTo(this.map);
	}
}
