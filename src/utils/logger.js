const pino = require('pino');
const { getContext } = require('./context');

const pinoLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  messageKey: 'message',
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level(label) {
      return { level: label };
    },
  },
});

function withContext(meta) {
  return { ...getContext(), ...meta };
}

module.exports = {
  info: (message, meta = {}) => pinoLogger.info(withContext(meta), message),
  warn: (message, meta = {}) => pinoLogger.warn(withContext(meta), message),
  error: (message, meta = {}) => pinoLogger.error(withContext(meta), message),
};
