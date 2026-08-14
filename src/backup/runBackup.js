const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const config = require('../config');
const logger = require('../utils/logger');

function execFileAsync(cmd, args, options) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, options, (err, stdout, stderr) => {
      if (err) return reject(new Error(stderr || err.message));
      resolve(stdout);
    });
  });
}

function timestampedFilename(now = new Date()) {
  const stamp = now.toISOString().replace(/[:.]/g, '-');
  return `backup-${stamp}.sql.gz`;
}

async function dumpDatabase(databaseUrl, outputPath) {
  const sql = await execFileAsync('pg_dump', ['--no-owner', '--no-privileges', databaseUrl], {
    maxBuffer: 1024 * 1024 * 200,
  });
  fs.writeFileSync(outputPath, zlib.gzipSync(sql));
}

function listBackups(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.startsWith('backup-') && f.endsWith('.sql.gz'));
}

function pruneOldBackups(dir, retentionDays, now = new Date()) {
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  const removed = [];

  for (const file of listBackups(dir)) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).mtimeMs < cutoff) {
      fs.unlinkSync(filePath);
      removed.push(file);
    }
  }
  return removed;
}

async function runBackup() {
  const dir = config.backup.dir;
  fs.mkdirSync(dir, { recursive: true });

  const filename = timestampedFilename();
  const outputPath = path.join(dir, filename);

  await dumpDatabase(config.database.url, outputPath);
  const sizeBytes = fs.statSync(outputPath).size;
  logger.info('Database backup created', { filename, sizeBytes });

  const removed = pruneOldBackups(dir, config.backup.retentionDays);
  if (removed.length > 0) logger.info('Pruned old backups', { removed });

  return { filename, sizeBytes, removed };
}

module.exports = { runBackup, dumpDatabase, pruneOldBackups, listBackups, timestampedFilename };
