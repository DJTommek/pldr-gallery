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

		// Markers for hidden overlays are not rendered and HTML does not exists, yet. When markers are rendered,
		// by default they are loaded with .thumbnail-not-loaded class and images must be loaded manually.
		// If images were loaded previously, eg in structure, they are loaded instantly once loadThumbnail() is called,
		// thanks to in-browser caching.
		this.map.on('overlayadd', loadThumbnail);
		this.overlays['Clustered'].on('clusterclick', loadThumbnail);

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
					'   <button class="btn btn-outline-primary btn-sm open-media-popup text-truncate" title="Open media in popup">Open</button>' +
					'   <button class="btn btn-outline-primary btn-sm open-media-info text-truncate" title="Show detailed file info">Details</button>' +
					'  </div>' +
					' </div>' +
					'</div>';
				this.addMarker(this.generateMarkerId(item), item, popupContent);
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

	/**
	 * @TODO create hash instead of encoding (encoding might be unnecessary too long)
	 * @param {Item} item
	 * @return {string}
	 */
	generateMarkerId(item) {
		let result = item.getEncodedPath();
		if (item.coords) {
			result += item.coords;
		}
		return btoa(result);
	}

	getMarkerFromStructureItem(item) {
		return this.getMarker(this.generateMarkerId(item));
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

	clearMarkers() {
		this.overlays['Default'].clearLayers()
		this.overlays['Clustered'].clearLayers()
		for (const markerId in this.markers) {
			this.markers[markerId].remove();
			delete this.markers[markerId];
		}
	}
}
