/*!
 * Structure map
 */
class StructureMap extends AbstractMap {
	defaultZoom = 13;
	defaultIcon = L.icon({
		iconUrl: 'images/marker-photo.svg',
		iconSize: [11, 11],
		iconAnchor: [5, 5],
	})

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
				const links = generateCoordsLinks(item.coords.lat, item.coords.lon);
				const popupContent = '<div id="map-info-window" data-item-index="' + item.index + '" class="row">' +
					' <div class="image col-md">' +
					'  <a href="' + item.getFileUrl() + '" target="_blank" title="Open in new window">' +
					'   <i class="thumbnail-loading-icon fa fa-circle-o-notch fa-spin"></i>' +
					'   <img class="thumbnail-not-loaded" src="' + item.getFileUrl() + '&type=thumbnail" onLoad="mapInfoWindowImageLoaded();" onError="mapInfoWindowImageError();" style="display: none;">' +
					'  </a>' +
					' </div>' +
					' <div class="content col-md">' +
					'  <button class="btn btn-primary btn-sm item-select text-truncate" title="Open \'' + item.text + '\' in popup ">' + item.paths.slice(-1)[0] + '</button>' +
					'  <h6>' + item.coords + ' ' +
					'   <i class="fa fa-clipboard copy-to-clipboard as-a-link" data-to-copy="' + item.coords + '" title="Copy ' + item.coords + ' to clipboard"></i>' +
					'   <a href="' + item.getFileUrl(true) + '" target="_blank" title="Download"><i class="fa fa-download"></i></a>' +
					'   <span class="as-a-link item-share" title="Share URL"><i class="fa fa-share-alt"></i></span>' +
					'  </h6>' +
					'  <ul class="list-inline">' +
					'   <li class="list-inline-item"><a href="' + links.betterlocation + '" target="_blank" title="Better Location">Better Location</a></li>' +
					'   <li class="list-inline-item"><a href="' + links.betterlocationbot + '" target="_blank" title="Open in Telegram via BetterLocationBot">Telegram</a></li>' +
					'   <li class="list-inline-item"><a href="' + links.google + '" target="_blank" title="Google maps">Google Maps</a></li>' +
					'   <li class="list-inline-item"><a href="' + links.mapycz + '" target="_blank" title="Mapy.cz">Mapy.cz</a></li>' +
					'   <li class="list-inline-item"><a href="' + links.waze + '" target="_blank" title="">Waze</a></li>' +
					'   <li class="list-inline-item"><a href="' + links.here + '" target="_blank" title="">Here</a></li>' +
					'   <li class="list-inline-item"><a href="' + links.osm + '" target="_blank" title="">OSM</a></li>' +
					'  </ul>' +
					' </div>' +
					'</div>';
				const markerId = btoa(item.coords + item.path); // @TODO create hash instead of encoding
				this.addMarker(markerId, item.coords, item.text, popupContent);
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

	addMarker(uniqueId, coords, title = null, popupContent = null) {
		if (uniqueId in this.markers) {
			throw new Error('Marker with ID already exists (coords: ' + coords + ')');
		}

		const marker = L.marker(coords, {
			title: title ? title : '',
			icon: this.defaultIcon,
		});
		if (popupContent) {
			const popup = L.popup().setContent(popupContent);
			marker.on('popupopen', function (event) {
				console.log('Popup open on marker coords ' + coords);
			});
			marker.bindPopup(popup);
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
