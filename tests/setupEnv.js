// Dummy env vars so `require('../src/config')` doesn't throw during tests.
// None of these are real credentials.
process.env.GITHUB_APP_ID = process.env.GITHUB_APP_ID || 'test-app-id';
process.env.GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || 'test-secret';
process.env.GITHUB_PRIVATE_KEY_BASE64 =
  process.env.GITHUB_PRIVATE_KEY_BASE64 || Buffer.from('test-key-not-real').toString('base64');

// Phase 2: only needed so `require('../src/config')` doesn't throw when
// unit tests import modules that pull in config as a side effect (e.g. the
// queue/db modules). Pure-logic unit tests (rules, duplicate detection,
// retry) don't actually open a connection to either service — but Phase 3
// added integration tests (issueEmbeddings, processEvent) that genuinely
// do query Postgres, so this fallback must point at a real, reachable
// database, not a placeholder. It matches the same default credentials
// docker-compose's bundled Postgres service and .env.example use, so
// `npm test` works out of the box against `docker compose up -d postgres`
// without anyone needing to export DATABASE_URL manually.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgres://github_ops_agent:github_ops_agent@localhost:5432/github_ops_agent';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Phase 3: config requires at least one LLM provider key present. Tests
// that actually exercise LLM/embedding calls mock global.fetch rather
// than hitting real Gemini/OpenAI endpoints, so this value never needs to
// be valid — it just needs to exist so config's requiredOneOf() check
// passes at import time.
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-gemini-key-not-real';

// Phase 6: dashboard auth config requires these to be present.
process.env.DASHBOARD_ADMIN_PASSWORD = process.env.DASHBOARD_ADMIN_PASSWORD || 'test-admin-password';
process.env.DASHBOARD_JWT_SECRET = process.env.DASHBOARD_JWT_SECRET || 'test-dashboard-jwt-secret-not-real';
