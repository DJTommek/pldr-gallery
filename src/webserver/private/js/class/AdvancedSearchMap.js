/*!
 * Advanced search map
 */
class AdvancedSearchMap extends AbstractMap {
	setMarker(latlng) {
		if (!this.markers.pickedLocation) {
			this.markers.pickedLocation = L.marker(latlng).addTo(this.map);
		} else {
			this.markers.pickedLocation.setLatLng(latlng);
		}
	}
}
