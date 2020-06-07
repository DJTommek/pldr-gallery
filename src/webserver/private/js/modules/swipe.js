
/**
 * Swipe detection
 *
 * @author https://gist.github.com/AlexEmashev/ee8302b5036b01362f63dab35948401f
 */
(function ($) {
	$.fn.swipeDetector = function (options) {
		// States: 0 - no swipe, 1 - swipe started, 2 - swipe released
		let swipeState = 0;
		// Coordinates when swipe started
		let startX = 0;
		let startY = 0;
		// Distance of swipe
		let pixelOffsetX = 0;
		let pixelOffsetY = 0;
		// Target element which should detect swipes.
		let swipeTarget = this;
		const defaultSettings = {
			// Amount of pixels, when swipe don't count.
			swipeThreshold: 50,
			// Flag that indicates that plugin should react only on touch events.
			// Not on mouse events too.
			useOnlyTouch: true,
		};

		// Initializer
		(function init() {
			options = $.extend(defaultSettings, options);
			// Support touch and mouse as well.
			swipeTarget.on('mousedown touchstart', swipeStart);
			$('html').on('mouseup touchend', swipeEnd);
			$('html').on('mousemove touchmove', swiping);
		})();

		function swipeStart(event) {
			if (options.useOnlyTouch && !event.originalEvent.touches) {
				return;
			}

			if (event.originalEvent.touches) {
				event = event.originalEvent.touches[0];
			}

			if (swipeState === 0) {
				swipeState = 1;
				startX = event.clientX;
				startY = event.clientY;
			}
		}

		function swipeEnd() {
			if (swipeState === 2) {
				swipeState = 0;

				if (Math.abs(pixelOffsetX) > Math.abs(pixelOffsetY) && Math.abs(pixelOffsetX) > options.swipeThreshold) {
					// Horizontal Swipe
					if (pixelOffsetX < 0) {
						swipeTarget.trigger($.Event('swipeLeft.sd'));
					} else {
						swipeTarget.trigger($.Event('swipeRight.sd'));
					}
				} else if (Math.abs(pixelOffsetY) > options.swipeThreshold) {
					// Vertical swipe
					if (pixelOffsetY < 0) {
						swipeTarget.trigger($.Event('swipeUp.sd'));
					} else {
						swipeTarget.trigger($.Event('swipeDown.sd'));
					}
				}
			}
		}

		function swiping(event) {
			// If swipe don't occuring, do nothing.
			if (swipeState !== 1) {
				return;
			}

			if (event.originalEvent.touches) {
				event = event.originalEvent.touches[0];
			}

			const swipeOffsetX = event.clientX - startX;
			const swipeOffsetY = event.clientY - startY;

			if (Math.abs(swipeOffsetX) > options.swipeThreshold || Math.abs(swipeOffsetY) > options.swipeThreshold) {
				swipeState = 2;
				pixelOffsetX = swipeOffsetX;
				pixelOffsetY = swipeOffsetY;
			}
		}

		return swipeTarget; // Return element available for chaining.
	};
})(jQuery);
