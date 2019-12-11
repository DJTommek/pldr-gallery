(function (window) {
	// Defined settings with default values
	let settingsValues = {
		theme: 'default',
		animationSpeed: 250,
		structureItemLimit: 1000,
		favouriteFolders: [],
		hashBeforeUnload: '/'
	};
	const Settings = {
		/**
		 * Return saved (or default) value from localstorage
		 *
		 * @param {string} name
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
					return parseInt(value);
				} else if (value === 'true') {
					return true;
				} else if (value === 'false') {
					return false;
				}
				try {
					return JSON.parse(value)
				} catch (error) {
					// do nothing, probably is not JSON
				}
				return value;
			}
			console.error('Settings with name "' + name + '" does not exists, cant load.');
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
			if (typeof name === 'undefined' || typeof value === 'undefined') {
				console.error('Settings.save() require two parameters.');
				return null;
			}
			if (!settingsValues[name]) {
				console.error('Settings with name "' + name + '" does not exists, cant save.');
				return null;
			}
			// is Array or JSON
			if (Array.isArray(value) || value && value.constructor === ({}).constructor) {
				value = JSON.stringify(value);
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
