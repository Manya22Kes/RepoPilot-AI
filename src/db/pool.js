const { Pool } = require('pg');
const config = require('../config');

const pool = new Pool({ connectionString: config.database.url });

pool.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ level: 'error', message: 'Postgres pool error', error: err.message }));
});

module.exports = pool;
