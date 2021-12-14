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

	let bindingsText;
	if (query.bindings.length > 10) {
		bindingsText = query.bindings.slice(0, 10).join(', ') + ', and more...';
	} else {
		bindingsText = query.bindings.join(', ');
	}
	LOG.debug('(Knex) Query "' + sqlText + '" with ' + query.bindings.length +  ' binding parameters [' + bindingsText + '] took ' + msToHuman(elapsedMs) + ' and returned ' + response.length + ' rows.', {console: true});
	delete queries[uid];
});

module.exports = knex;

