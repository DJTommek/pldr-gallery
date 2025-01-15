/*!
 * Map to browser photos available in given bounding box
 */
class BrowserMap extends AbstractStructureMap {

	init() {
		const self = this;

		super.init();

		this.map.on('load moveend', async function () {
			if (structure.currentFolderItem === null) {
				return;
			}
			await self.loadData(structure.currentFolderItem);
		});

		structure.addEventListener('directorychange', async function (event) {
			await self.loadData(event.detail.newPath);
		})

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
	 * @param {FolderItem} directoryItem
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

		const url = '/api/search?' + params.toString();

		const response = await fetch(url);
		const result = await response.json();

		if (result.error === true) {
			throw new Error(result.message);
		}

		// Previously loaded markers
		let markerIdsToRemove = Object.keys(this.markers);

		let index = 0;
		for (const fileRaw of result.result.files) {
			const fileItem = new FileItem(index++, fileRaw)
			const markerId = this.generateMarkerId(fileItem);
			if (markerId in this.markers) { // This item is already rendered in the map
				markerIdsToRemove = markerIdsToRemove.filter((value) => value !== markerId)
				continue;
			}

			this.addMarker(markerId, fileItem, this.fileItemPopupContent(fileItem, false))
		}

		for (const markerIdToRemove of markerIdsToRemove) {
			this.removeMarker(markerIdToRemove);
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
