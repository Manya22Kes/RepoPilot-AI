const IORedis = require('ioredis');
const config = require('../config');

const connection = new IORedis(config.redis.url, {
  lazyConnect: true,
  maxRetriesPerRequest: null,
});

connection.on('error', (err) => {
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ level: 'error', message: 'Redis connection error', error: err.message }));
});

module.exports = connection;
