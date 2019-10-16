(function (window) {
	// Defined settings with default values
	var settingsValues = {
		theme: 'default',
		animationSpeed: 250,
		hashBeforeUnload: '/'
	}
	var Settings = {
		/**
		 * Return saved (or default) value from localstorage
		 *
		 * @param {string} name
		 * @returns {string|int|boolean}
		 */
		load: function (name) {
			// return all values
			if (typeof name === 'undefined') {
				return settingsValues;
			}
			// return specific value
			let value = settingsValues[name];
			if (value) {
				if (isNumeric(value)) {
					value = parseInt(value);
				} else if (value === 'true') {
					value = true;
				} else if (value === 'false') {
					value = false;
				}
				return value;
			}
			console.error('Settings with name "' + name + '" does not exists, cant load.')
			return null;
		},

		/**
		 * Save value into localstorage
		 *
		 * @param {string} name
		 * @param {string|int|boolean} value
		 * @returns {string|int|boolean}
		 */
		save: function (name, value) {
			if (!settingsValues[name]) {
				console.error('Settings with name "' + name + '" does not exists, cant save.')
				return null;
			}
			settingsValues[name] = value;
			localStorage.setItem('pldr-settings-' + name, value);
			return Settings.load(name);
		},
	}

	// Save all settings to localStorage if not saved before
	for (settingsName in settingsValues) {
		let savedValue = localStorage.getItem('pldr-settings-' + settingsName);
		if (savedValue) {
			settingsValues[settingsName] = savedValue;
		} else {
			console.log('Settings "' + settingsName + '"  was not saved. Saved with default value "' + settingsValues[settingsName] + '"');
			Settings.save(settingsName, settingsValues[settingsName])
		}
	}

	window.Settings = Settings;
})(window);
