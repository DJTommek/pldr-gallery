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
	LOG.debug('(Knex) Query "' + query.sql + '" with ' + query.bindings.length +  ' binding parameters [' + query.bindings.join(', ') + '] took ' + msToHuman(elapsedMs) + ' and returned ' + response.length + ' rows.', {console: true});
	delete queries[uid];
});

module.exports = knex;

