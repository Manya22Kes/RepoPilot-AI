const jwt = require('jsonwebtoken');
const config = require('../config');
const logger = require('../utils/logger');

const JWT_LIFETIME_SECONDS = 9 * 60;
const JWT_CLOCK_DRIFT_LEEWAY_SECONDS = 60;

const installationTokenCache = new Map();
const TOKEN_REFRESH_BUFFER_MS = 60_000; // refresh 60s before actual expiry

function generateAppJwt() {
  const nowSeconds = Math.floor(Date.now() / 1000);

  return jwt.sign(
    {
      iat: nowSeconds - JWT_CLOCK_DRIFT_LEEWAY_SECONDS,
      exp: nowSeconds + JWT_LIFETIME_SECONDS,
      iss: config.github.appId,
    },
    config.github.privateKey,
    { algorithm: 'RS256' }
  );
}

async function getInstallationAccessToken(installationId) {
  const cached = installationTokenCache.get(installationId);
  if (cached && cached.expiresAt - Date.now() > TOKEN_REFRESH_BUFFER_MS) {
    return cached.token;
  }

  const appJwt = generateAppJwt();

  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${appJwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Failed to obtain installation access token (HTTP ${response.status}): ${body}`
    );
  }

  const data = await response.json();

  installationTokenCache.set(installationId, {
    token: data.token,
    expiresAt: new Date(data.expires_at).getTime(),
  });

  logger.info('Issued new installation access token', {
    installationId,
    expiresAt: data.expires_at,
  });

  return data.token;
}

module.exports = { generateAppJwt, getInstallationAccessToken };
