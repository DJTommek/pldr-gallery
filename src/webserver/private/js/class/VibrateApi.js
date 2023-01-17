/**
 * Wrapper for native Vibrate API
 *
 * @link https://developer.mozilla.org/en-US/docs/Web/API/Navigator/vibrate
 */
class VibrateApi {
	constructor() {
		this._isSupported = 'vibrate' in navigator;
	}

	get isSupported() {
		return this._isSupported;
	}

	vibrate(pattern) {
		if (this.isSupported === false) {
			return;
		}
		navigator.vibrate(pattern);
	}
}
