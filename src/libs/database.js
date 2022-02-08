const CONFIG = require('./config.js');
const knex = require('knex')(CONFIG.db.knex);
const LOG = require('./log.js');

const queries = {};

knex.on('query', function (query) {
	const uid = query.__knexQueryUid;
	query.timeStart = process.hrtime();
	queries[uid] = query;
}).on('query-response', function (response, query) {
	const uid = query.__knexQueryUid;
	const elapsedMs = hrtime(process.hrtime(queries[uid].timeStart));

	let sqlText = query.sql;
	if (sqlText.length > 500) {
		sqlText = sqlText.substring(0, 500) + '...';
	}

	let logText = '(Knex) Query "' + sqlText + '"';
	if (query.bindings) {
		let bindingsText;
		if (query.bindings.length > 10) {
			bindingsText = query.bindings.slice(0, 10).join(', ') + ', and more...';
		} else {
			bindingsText = query.bindings.join(', ');
		}
		logText += ' with ' + query.bindings.length +  ' binding parameters [' + bindingsText + ']';
	}
	logText += ' took ' + msToHuman(elapsedMs) + '';
	if (response) {
		logText += ' and returned ' + response.length + ' rows.';
	}
	LOG.debug(logText, {console: true});
	delete queries[uid];
});

module.exports = knex;

