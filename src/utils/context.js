const { AsyncLocalStorage } = require('node:async_hooks');

const storage = new AsyncLocalStorage();

function runWithContext(context, fn) {
  return storage.run(context, fn);
}

function getContext() {
  return storage.getStore() || {};
}

module.exports = { runWithContext, getContext };
