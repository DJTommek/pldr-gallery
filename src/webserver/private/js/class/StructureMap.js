/*!
 * Structure map
 */
class StructureMap extends AbstractMap {
	defaultZoom = 13;
	defaultIcon = L.icon({
		iconUrl: 'images/marker-photo.svg',
		iconSize: [11, 11],
		iconAnchor: [5, 5],
	});

	init() {
		super.init();

		const locateControl = L.control.locate({
			setView: false,
			strings: {
				popup: function (params) {
					const markerLatLng = locateControl._marker.getLatLng();
					const latLon = markerLatLng.lat.toFixed(6) + ',' + markerLatLng.lng.toFixed(6);
					return '<p>Browser location: <b><a href="{$basePath|noescape}/' + latLon + '">' + latLon + '</a></b> (accuracy <b>' + formatDistance(parseInt(params.distance)) + '</b>)</p>';
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
		return this;
	}

	markersFromStructureFiles(fileItems) {
		this.clearMarkers();
		const mapBounds = new L.LatLngBounds();
		for (const item of fileItems) {
			if (item.coords) {
				const popupContent = '<div id="map-info-window" data-item-index="' + item.index + '" class="row">' +
					' <div class="image col-md">' +
					'  <a href="' + item.getFileUrl() + '" target="_blank" title="Open in new window">' +
					'   <i class="thumbnail-loading-icon fa fa-circle-o-notch fa-spin"></i>' +
					'   <img class="thumbnail-not-loaded" src="' + item.getThumbnailUrl() + '" onLoad="mapInfoWindowImageLoaded();" onError="mapInfoWindowImageError();" style="display: none;">' +
					'  </a>' +
					' </div>' +
					' <div class="content col-md">' +
					'  <h6>' + item.text + '</h6>' +
					'  <div class="btn-group" role="group">' +
					'   <button class="btn btn-outline-primary btn-sm open-media-popup text-truncate" title="Open media in popup">Popup</button>' +
					'   <button class="btn btn-outline-primary btn-sm open-media-info text-truncate" title="Show detailed file info">Info</button>' +
					'  </div>' +
					' </div>' +
					'</div>';
				const markerId = btoa(encodeURIComponent(item.coords + item.path)); // @TODO create hash instead of encoding
				this.addMarker(markerId, item, popupContent);
				mapBounds.extend(item.coords);
			}
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
		return this.getMarker(btoa(item.coords + item.path));
	}

	generateThumbnailIcon(item) {
		const thumbnailUrl = item.getThumbnailUrl();
		return L.divIcon({
			className: 'custom-div-icon',
			html: '<div class="map-thumbnail-icon"><img class="thumbnail thumbnail-not-loaded" src="' + transparentPixelBase64 + '" data-src="' + thumbnailUrl + '"></div>',
			iconSize: [50, 50],
			iconAnchor: [25, 25]
		});
	}

	addMarker(uniqueId, item, popupContent = null) {
		if (uniqueId in this.markers) {
			throw new Error('Marker with ID already exists (coords: ' + item.coords + ')');
		}

		const marker = L.marker(item.coords, {
			title: item.text ? item.text : '',
			icon: (item.isImage || item.isVideo) ? this.generateThumbnailIcon(item) : this.defaultIcon,
		});
		if (popupContent) {
			const popup = L.popup().setContent(popupContent);
			marker.bindPopup(popup, {
				minWidth: 200,
			});
		}
		marker.addTo(this.map);
		this.markers[uniqueId] = marker;
	}

	clearMarkers() {
		for (const markerId in this.markers) {
			this.markers[markerId].remove();
			delete this.markers[markerId];
		}
	}
}
