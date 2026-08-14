const fs = require("fs");
require("dotenv").config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function loadPrivateKey() {
  if (process.env.GITHUB_PRIVATE_KEY_BASE64) {
    return Buffer.from(
      process.env.GITHUB_PRIVATE_KEY_BASE64,
      "base64",
    ).toString("utf8");
  }
  if (process.env.GITHUB_PRIVATE_KEY_PATH) {
    return fs.readFileSync(process.env.GITHUB_PRIVATE_KEY_PATH, "utf8");
  }
  throw new Error(
    "Provide either GITHUB_PRIVATE_KEY_BASE64 or GITHUB_PRIVATE_KEY_PATH in the environment.",
  );
}

function requiredOneOf(names) {
  const found = names.filter((name) => process.env[name]);
  if (found.length === 0) {
    throw new Error(
      `At least one of these environment variables is required: ${names.join(", ")}`,
    );
  }
  return found;
}

function loadConfig() {
  return {
    port: Number(process.env.PORT) || 3000,
    nodeEnv: process.env.NODE_ENV || "development",
    github: {
      appId: required("GITHUB_APP_ID"),
      webhookSecret: required("GITHUB_WEBHOOK_SECRET"),
      privateKey: loadPrivateKey(),
    },
    database: {
      url: required("DATABASE_URL"),
    },
    redis: {
      url: required("REDIS_URL"),
    },
    llm: {
      availableProviders: requiredOneOf(["GEMINI_API_KEY", "OPENAI_API_KEY"]),
      gemini: {
        apiKey: process.env.GEMINI_API_KEY || null,
        model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
        embeddingModel:
          process.env.GEMINI_EMBEDDING_MODEL || "gemini-embedding-001",
      },
      openai: {
        apiKey: process.env.OPENAI_API_KEY || null,
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      },
      providerOrder: (process.env.LLM_PROVIDER_ORDER || "gemini,openai")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      embeddingProvider: process.env.EMBEDDING_PROVIDER || "gemini",
    },
    stalePrScan: {
      cron: process.env.STALE_PR_SCAN_CRON || "0 9 * * *",
      thresholdDays: Number(process.env.STALE_PR_THRESHOLD_DAYS) || 7,
      renudgeDays: Number(process.env.STALE_PR_RENUDGE_DAYS) || 7,
    },
    dashboard: {
      adminPassword: required("DASHBOARD_ADMIN_PASSWORD"),
      jwtSecret: required("DASHBOARD_JWT_SECRET"),
    },
    backup: {
      dir: process.env.BACKUP_DIR || "./backups",
      retentionDays: Number(process.env.BACKUP_RETENTION_DAYS) || 7,
      cron: process.env.DB_BACKUP_CRON || "0 3 * * *",
    },
    digest: {
      cron: process.env.DIGEST_CRON || "0 9 * * 1", // Monday 9am
    },
  };
}

module.exports = loadConfig();
