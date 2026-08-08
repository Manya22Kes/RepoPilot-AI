const { runMigrations } = require('./migrate');
const logger = require('../utils/logger');
const pool = require('./pool');

runMigrations()
  .then(() => {
    logger.info('Migrations complete');
    return pool.end();
  })
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error('Migration failed', { error: err.message });
    process.exit(1);
  });
