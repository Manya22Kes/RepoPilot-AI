const { getRepoSettings, upsertRepoSettings, DEFAULT_SETTINGS } = require('../src/db/repoSettings');
const pool = require('../src/db/pool');

const REPO = 'test/repo-settings-integration';

describe('repo_settings (integration, real Postgres)', () => {
  afterEach(async () => {
    await pool.query('DELETE FROM repo_settings WHERE repo_full_name = $1', [REPO]);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('returns all-enabled defaults for a repo with no row yet', async () => {
    const settings = await getRepoSettings(REPO);
    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it('creates a row on first upsert and returns the merged settings', async () => {
    const settings = await upsertRepoSettings(REPO, 123, { triageEnabled: false });

    expect(settings).toEqual({ ...DEFAULT_SETTINGS, triageEnabled: false });
  });

  it('persists across a fresh read after upsert', async () => {
    await upsertRepoSettings(REPO, 123, { stalePrScanEnabled: false, docsSyncEnabled: false });

    const settings = await getRepoSettings(REPO);
    expect(settings).toEqual({
      ...DEFAULT_SETTINGS,
      stalePrScanEnabled: false,
      docsSyncEnabled: false,
    });
  });

  it('a partial update only changes the specified keys, leaving others intact', async () => {
    await upsertRepoSettings(REPO, 123, { triageEnabled: false, prSummaryEnabled: false });
    const settings = await upsertRepoSettings(REPO, 123, { triageEnabled: true });

    expect(settings).toEqual({
      ...DEFAULT_SETTINGS,
      triageEnabled: true,
      prSummaryEnabled: false, // untouched by the second call
    });
  });

  it('updates installation_id on subsequent upserts (e.g. app reinstalled)', async () => {
    await upsertRepoSettings(REPO, 123, {});
    await upsertRepoSettings(REPO, 456, {});

    const { rows } = await pool.query('SELECT installation_id FROM repo_settings WHERE repo_full_name = $1', [REPO]);
    expect(Number(rows[0].installation_id)).toBe(456);
  });
});
