const FS = require('fs');
const PATH = require('path');
const {requestingCmdHelp} = require("../libs/utils/utils");
const localConfig = PATH.join(__dirname, '../../data/config.local.js');
const localExampleConfig = PATH.join(__dirname, '../../data/config.local.example.js');

/**
 * Generate local config file from example.
 *
 * @param {boolean} overrideConfig True for backuping already generated local config file and then generate new. False to quit script if local config file already exists.
 */
module.exports.run = function (overrideConfig) {
	console.log('(Config) Preparing local config from "' + localExampleConfig + '"...');
	if (FS.existsSync(localConfig)) {
		console.log('(Config) Local config file "' + localConfig + '" already exists.');
		if (overrideConfig === false) {
			console.log('(Config) Config override is set to false, quitting script...');
			return;
		} else if (overrideConfig === true) {
			console.log('(Config) Config override is set to true, creating backup first...');
			const nowISO = (new Date()).toISOString().split(':').join('-'); // replace characters which are invalid in file name
			const localConfigBackup = PATH.join(__dirname, '../../data/config.local.backup.' + nowISO + '.js');
			FS.renameSync(localConfig, localConfigBackup);
			console.log('(Config) Backup "' + localConfigBackup + '" was created.');
		}
	}
	if (!FS.existsSync(localExampleConfig)) {
		console.error('(Config) Local example config file "' + localConfig + '" is missing. Download it from https://github.com/DJTommek/pldr-gallery/blob/master/data/config.local.example.js');
		return;
	}
	FS.copyFileSync(localExampleConfig, localConfig);
	console.log('(Config) Local config file was generated, you can edit it now "' + localConfig + '".');
}

if (require.main === module) {
	const args = process.argv.slice(2);
	if (requestingCmdHelp(args)) {
		console.log('Create config file as /data/config.local.js from "/data/config.local.example.js". Do nothing, if file already exists.')
		console.log('Optional arguments:')
		console.log('	--force		if file already exists, will be renamed and new config will be created.')
	} else {
		const override = args.includes('--force');
		module.exports.run(override);
	}
}
