/*!
 * Abstract map class with predefined features to easily implement and use FileItem.
 */
class AbstractStructureMap extends AbstractMap {
	/**
	 * @param {string} elementId
	 * @param {Structure} structure
	 */
	constructor(elementId, structure) {
		super(elementId);

		this.structure = structure;
	}

	init() {
		super.init();

		this.map.on('overlayadd', loadThumbnail);
		this.overlays['Clustered'].on('animationend', loadThumbnail);

		return this;
	}

	clearMarkers() {
		this.overlays['Default'].clearLayers()
		this.overlays['Clustered'].clearLayers()
		for (const markerId in this.markers) {
			this.markers[markerId].remove();
			delete this.markers[markerId];
		}
	}

	removeMarker(id) {
		const marker = this.markers[id];
		if (!marker) {
			return;
		}

		this.overlays['Default'].removeLayer(marker);
		this.overlays['Clustered'].removeLayer(marker);
		marker.remove();
		delete this.markers[id];
	}

	addMarker(uniqueId, item, popupContent = null) {
		if (uniqueId in this.markers) {
			throw new Error('Marker with ID already exists (coords: ' + item.coords + ')');
		}

		let markerIcon = null;
		if (
			(item.isImage && CONFIG.thumbnails.image.enabled)
			|| (item.isVideo && CONFIG.thumbnails.video.enabled)
		) {
			markerIcon = this.generateThumbnailIcon(item);
		}
		markerIcon = markerIcon ?? this.defaultIcon;

		const marker = L.marker(item.coords, {
			title: item.text ? item.text : '',
			icon: markerIcon,
		});
		if (popupContent) {
			const popup = L.popup().setContent(popupContent);
			marker.bindPopup(popup, {
				minWidth: 200,
			});
		}
		marker.on('click', function (event) {
			vibrateApi.vibrate(Settings.load('vibrationOk'));
		});
		marker.addTo(this.overlays['Default']);
		marker.addTo(this.overlays['Clustered']);
		this.markers[uniqueId] = marker;
	}

	/**
	 * @TODO create hash instead of encoding (encoding might be unnecessary too long)
	 * @param {FileItem} fileItem
	 * @return {string}
	 */
	generateMarkerId(fileItem) {
		let result = fileItem.getEncodedPath();
		if (fileItem.coords) {
			result += fileItem.coords;
		}
		return btoa(result);
	}

	/**
	 * @param {FileItem} fileItem
	 * @return {L.divIcon}
	 */
	generateThumbnailIcon(fileItem) {
		const thumbnailUrl = fileItem.getThumbnailUrl();
		return L.divIcon({
			className: 'custom-div-icon',
			html: '<div class="map-thumbnail-icon"><img class="thumbnail thumbnail-not-loaded" src="' + transparentPixelBase64 + '" data-src="' + thumbnailUrl + '"></div>',
			iconSize: [50, 50],
			iconAnchor: [25, 25]
		});
	}

	fileItemPopupContent(fileItem, withButtons = true) {
		let html = '<div id="map-info-window" data-item-index="' + fileItem.index + '" class="row">' +
			' <div class="image col-md">' +
			'  <a href="' + fileItem.getFileUrl() + '" target="_blank" title="Open in new window">' +
			'   <i class="thumbnail-loading-icon fa fa-circle-o-notch fa-spin"></i>' +
			'   <img class="thumbnail-not-loaded" src="' + fileItem.getThumbnailUrl() + '" onLoad="mapInfoWindowImageLoaded();" onError="mapInfoWindowImageError();" style="display: none;">' +
			'  </a>' +
			' </div>' +
			' <div class="content col-md">' +
			'  <h6>' + fileItem.text + '</h6>';
		if (withButtons) {
			html += '  <div class="btn-group" role="group">' +
				'   <button class="btn btn-outline-primary btn-sm open-media-popup text-truncate" title="Open media in popup">Open</button>' +
				'   <button class="btn btn-outline-primary btn-sm open-media-info text-truncate" title="Show detailed file info">Details</button>' +
				'  </div>';
		}
		html += ' </div>' +
			'</div>';
		return html;
	}
}
