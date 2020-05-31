(async function () {
	console.log('---[npm post install start]---');

	const scriptLocalConfig = __dirname + '/src/tools/copy-example-local-config.js';
	console.log('Starting script "' + scriptLocalConfig + '"...');
	const overrideConfig = false;
	require(scriptLocalConfig).run(overrideConfig);
	console.log('Script "' + scriptLocalConfig + '" has been finished.');

	const scriptCreateDemoDb = __dirname + '/src/tools/knex.create-demo-db.js';
	console.log('Starting script "' + scriptCreateDemoDb + '"...');
	const purge = false;
	const insertDemoData = true;
	await require(scriptCreateDemoDb).run(purge, insertDemoData);
	console.log('Script "' + scriptCreateDemoDb + '" has been finished.');

	console.log('---[npm post install finished]---');
})();

