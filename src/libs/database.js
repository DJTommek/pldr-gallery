const CONFIG = require('./config.js');
const knex = require('knex')(CONFIG.db.knex);
module.exports = knex;

