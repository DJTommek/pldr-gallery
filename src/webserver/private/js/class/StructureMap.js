/*!
 * Structure map
 */
class StructureMap extends AbstractStructureMap {
	defaultZoom = 13;

	init() {
		super.init();

		// Markers for hidden overlays are not rendered and HTML does not exists, yet. When markers are rendered,
		// by default they are loaded with .thumbnail-not-loaded class and images must be loaded manually.
		// If images were loaded previously, eg in structure, they are loaded instantly once loadThumbnail() is called,
		// thanks to in-browser caching.
		this.map.on('overlayadd', loadThumbnail);
		this.overlays['Clustered'].on('clusterclick', loadThumbnail);

		return this;
	}

	/**
	 * @param {array<FileItem>} fileItems
	 */
	markersFromStructureFiles(fileItems) {
		this.clearMarkers();
		const mapBounds = new L.LatLngBounds();
		for (const fileItem of fileItems) {
			if (!fileItem.coords) {
				continue;
			}

			this.addMarker(this.generateMarkerId(fileItem), fileItem, this.fileItemPopupContent(fileItem));
			mapBounds.extend(fileItem.coords);
		}
		if (mapBounds.isValid()) { // might be invalid if no exif data
			this.mapShow();
			this.map.fitBounds(mapBounds, {
				maxZoom: 16,
			});
		} else {
			this.mapHide();
		}
	}

	getMarkerFromStructureItem(item) {
		return this.getMarker(this.generateMarkerId(item));
	}
}
