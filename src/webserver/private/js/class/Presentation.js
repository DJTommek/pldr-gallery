/*!
 * Presentation
 */
class Presentation {
	constructor() {
		this.running = false;
		this.intervalId = null;
	}

	start() {
		if (presentation.isLast()) {
			return; // there are no more items to go so dont even start the presentation
		}
		$('#popup-footer-presentation-stop').show();
		$('#popup-footer-presentation-start').hide();
		$('#popup-footer-presentation-progress').show();
		presentation.running = true;
		// if video, first play it
		if (S.getCurrentFile().isVideo) {
			videoPlay();
		} else if (S.getCurrentFile().isAudio) {
			audioPlay();
		} else {
			itemNext(false);
		}
	}

	stop() {
		$('#popup-footer-presentation-start').show();
		$('#popup-footer-presentation-stop').hide();
		$('#popup-footer-presentation-progress').hide().css('width', '100%');
		this.running = false;
		this.clearTimeout();
	}

	toggle() {
		if (presentation.running) {
			presentation.stop();
		} else {
			presentation.start();
		}
	}

	clearTimeout() {
		clearTimeout(this.intervalId);
	}

	isLast() {
		return S.getNextFile(S.getCurrentFile().index) === null;
	}

	next() {
		if (presentation.isLast()) {
			presentation.stop();
		}
		itemNext(false);
	}
}
