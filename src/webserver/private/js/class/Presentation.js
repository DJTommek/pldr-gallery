/*!
 * Presentation
 */
class Presentation {
	/**
	 * @param {MediaPopup} mediaPopup
	 */
	constructor(mediaPopup) {
		this.mediaPopup = mediaPopup;

		this.element = mediaPopup.element.querySelector('.media-popup-presentation-progress');

		this.duration = 5_000;
		this.running = false;
		this.intervalId = null;
	}

	init() {
		const self = this;

		document.addEventListener('keydown', function (event) {
			if (self.mediaPopup.isActive() === false) {
				console.debug('[Presentation] Ignoring keydown event, popup is not active');
			}
			if (event.ctrlKey === true && event.key === ' ') {
				flashMessage('presentation mode toggle');
				self.toggle();
				event.stopImmediatePropagation();
			}
		});

		this.mediaPopup.addEventListener('beforeshowitem', function (event) {
			self.clearTimeout();
		});
		this.mediaPopup.addEventListener('afterhideitem', function (event) {
			self.stop();
		});
		this.mediaPopup.addEventListener('itemloaddone', function (event) {
			self.clearTimeout();
			if (self.running === false) {
				return;
			}

			if (self.mediaPopup.itemCurrent.isVideo) {
				self.mediaPopup.elementMediaVideo.play();
				return;
			} else if (self.mediaPopup.itemCurrent.isAudio) {
				self.mediaPopup.elementMediaAudio.play();
				return;
			}

			self.element.style.transition = 'width ' + self.duration + 'ms linear';
			self.element.style.width = '0%';

			self.intervalId = setTimeout(function () {
				self.next();
			}, self.duration);
		});

		this.mediaPopup.elementMediaVideo.addEventListener('ended', function (event) {
			if (self.running) {
				self.next();
			}
		});
		this.mediaPopup.elementMediaAudio.addEventListener('ended', function (event) {
			if (self.running) {
				self.next();
			}
		});

		return this;
	}

	start() {
		if (presentation.isLast()) {
			return; // there are no more items to go so dont even start the presentation
		}
		this.element.style.display = '';
		this.element.style.width = '';
		presentation.running = true;

		if (this.mediaPopup.itemCurrent.isVideo) {
			this.mediaPopup.elementMediaVideo.play();
		} else if (this.mediaPopup.itemCurrent.isAudio) {
			this.mediaPopup.elementMediaAudio.play();
		} else {
			this.next();
		}
	}

	stop() {
		this.element.style.display = 'none';
		this.running = false;
		this.element.style.transition = '';
		this.element.style.width = '100%';

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
		this.intervalId = null;
	}

	isLast() {
		return this.mediaPopup.itemNext === null;
	}

	next() {
		this.element.style.transition = '';
		this.element.style.width = '';
		if (presentation.isLast()) {
			presentation.stop();
		}
		this.mediaPopup.elementNext.click();
	}
}
