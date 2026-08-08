module.exports = {
  testEnvironment: 'node',
  // Only this backend project's own tests — the dashboard/ subdirectory
  // is a separate sub-project with its own test runner (vitest, run via
  // `npm test` inside dashboard/), not something this Jest config should
  // ever try to parse (it uses JSX/ESM, which this CommonJS/Node config
  // isn't set up to handle, nor should it need to be).
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  // Integration-style tests (health.test.js) exercise real Redis/Postgres
  // connections. We close what we open in afterAll hooks, but BullMQ/
  // ioredis internals can leave a stray timer or socket behind even after
  // .close()/.quit() resolve — forceExit is the documented, accepted
  // safety net for that class of leak rather than a substitute for
  // closing things properly.
  forceExit: true,
};
