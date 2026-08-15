const config = require('../config');
const { countUsers, createUser } = require('../db/users');
const { hashPassword } = require('../utils/passwords');
const logger = require('../utils/logger');

/**
 * Runs once, at app startup. If no users exist yet, creates exactly one
 * admin from DASHBOARD_ADMIN_EMAIL/DASHBOARD_ADMIN_PASSWORD, so upgrading
 * from the old single-shared-password model doesn't require a manual
 * migration step. Once any user exists, this is permanently a no-op.
 */
async function bootstrapAdminIfNeeded() {
  const existing = await countUsers();
  if (existing > 0) return;

  const passwordHash = await hashPassword(config.dashboard.adminPassword);
  await createUser(config.dashboard.adminEmail, passwordHash, 'admin');
  logger.info('Bootstrapped initial admin user', { email: config.dashboard.adminEmail });
}

module.exports = { bootstrapAdminIfNeeded };
