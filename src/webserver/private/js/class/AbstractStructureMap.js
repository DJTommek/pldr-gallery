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
		for (const markerId in this.mapElements) {
			this.mapElements[markerId].remove();
			delete this.mapElements[markerId];
		}
	}

	removeMapElement(id) {
		const mapElement = this.mapElements[id];
		if (!mapElement) {
			return;
		}

		this.overlays['Default'].removeLayer(mapElement);
		this.overlays['Clustered'].removeLayer(mapElement);
		mapElement.remove();
		delete this.mapElements[id];
	}

	/**
	 * @param {string} uniqueId
	 * @param {FileItem} item
	 * @param {string|null} popupContent
	 */
	addMarker(uniqueId, item, popupContent = null) {
		if (uniqueId in this.mapElements) {
			throw new Error('Marker with ID already exists (coords: ' + item.coords + ')');
		}

		const markerOptions = {
			title: item.text ? item.text : ''
		};

		if (
			(item.isImage && CONFIG.thumbnails.image.enabled)
			|| (item.isVideo && CONFIG.thumbnails.video.enabled)
		) {
			markerOptions.icon = this.generateThumbnailIcon(item);
		}

		const marker = L.marker(item.coords, markerOptions);
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
		this.mapElements[uniqueId] = marker;
	}

	/**
	 * @TODO create hash instead of encoding (encoding might be unnecessary too long)
	 * @param {FileItem} fileItem
	 * @return {string}
	 */
	generateMapElementId(fileItem) {
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

	/**
	 * @param {FileItem} fileItem
	 * @param {boolean} withButtons
	 * @return {string}
	 */
	fileItemPopupContent(fileItem, withButtons = true) {
		const thumbnailUrl = fileItem.getThumbnailUrl();
		const fileUrl = fileItem.getFileUrl() ?? fileItem.getFileUrl(true);
		const thumbnailIconHtml = thumbnailUrl === null
			? '<i class="thumbnail-loading-icon fa fa-' + fileItem.icon + '"></i>'
			: '<i class="thumbnail-loading-icon fa fa-circle-o-notch fa-spin"></i>'

		let html = '<div id="map-info-window" data-item-index="' + fileItem.index + '" class="row">' +
			' <div class="image col-md">' +
			'  <a href="' + fileUrl + '" target="_blank" title="Open in new window">' +
			thumbnailIconHtml +
			(thumbnailUrl === null
					? ''
					: '<img class="thumbnail-not-loaded" src="' + fileItem.getThumbnailUrl() + '" onLoad="mapInfoWindowImageLoaded();" onError="mapInfoWindowImageError();" style="display: none;">'
			) +
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
