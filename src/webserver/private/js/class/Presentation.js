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
		$('#popup-presentation-progress').show();
		presentation.running = true;
		// if video, first play it
		if (structure.getCurrentFile().isVideo) {
			videoPlay();
		} else if (structure.getCurrentFile().isAudio) {
			audioPlay();
		} else {
			itemNext(false);
		}
	}

	stop() {
		$('#popup-presentation-progress').hide().css('width', '100%');
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
		$('#popup-presentation-progress').css({'transition': ''});
		$('#popup-presentation-progress').css('width', '100%');
		clearTimeout(this.intervalId);
	}

	isLast() {
		return structure.getNextFile(structure.getCurrentFile().index) === null;
	}

	next() {
		if (presentation.isLast()) {
			presentation.stop();
		}
		itemNext(false);
	}
}
