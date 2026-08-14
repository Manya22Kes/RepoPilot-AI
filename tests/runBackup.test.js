const fs = require('fs');
const path = require('path');
const os = require('os');
const { pruneOldBackups, listBackups, timestampedFilename } = require('../src/backup/runBackup');

describe('timestampedFilename', () => {
  it('produces a sortable, filesystem-safe filename', () => {
    const name = timestampedFilename(new Date('2026-08-10T03:00:00.000Z'));
    expect(name).toBe('backup-2026-08-10T03-00-00-000Z.sql.gz');
  });
});

describe('backup rotation', () => {
  let dir;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function makeBackupFile(name, ageDays) {
    const filePath = path.join(dir, name);
    fs.writeFileSync(filePath, 'fake dump data');
    const pastTime = Date.now() - ageDays * 24 * 60 * 60 * 1000;
    fs.utimesSync(filePath, pastTime / 1000, pastTime / 1000);
  }

  it('lists only backup files, ignoring anything else in the directory', () => {
    makeBackupFile('backup-a.sql.gz', 1);
    fs.writeFileSync(path.join(dir, 'not-a-backup.txt'), 'x');
    expect(listBackups(dir)).toEqual(['backup-a.sql.gz']);
  });

  it('keeps backups within the retention window', () => {
    makeBackupFile('backup-recent.sql.gz', 2);
    const removed = pruneOldBackups(dir, 7);
    expect(removed).toEqual([]);
    expect(listBackups(dir)).toContain('backup-recent.sql.gz');
  });

  it('removes backups older than the retention window', () => {
    makeBackupFile('backup-old.sql.gz', 10);
    const removed = pruneOldBackups(dir, 7);
    expect(removed).toEqual(['backup-old.sql.gz']);
    expect(listBackups(dir)).toEqual([]);
  });

  it('returns an empty array when the backup directory does not exist yet', () => {
    expect(pruneOldBackups(path.join(dir, 'nonexistent'), 7)).toEqual([]);
  });
});
