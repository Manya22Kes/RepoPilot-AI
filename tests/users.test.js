const { createUser, getUserByEmail, getUserById, countAdmins, deleteUser } = require('../src/db/users');
const pool = require('../src/db/pool');

const TEST_EMAIL = 'test-users-integration@example.com';

describe('users (integration, real Postgres)', () => {
  afterEach(async () => {
    await pool.query('DELETE FROM users WHERE email LIKE $1', ['%users-integration%']);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('creates a user and never returns the password hash', async () => {
    const user = await createUser(TEST_EMAIL, 'hashed-value', 'admin');
    expect(user.email).toBe(TEST_EMAIL);
    expect(user.role).toBe('admin');
    expect(user.password_hash).toBeUndefined();
  });

  it('lowercases and trims email on creation and lookup', async () => {
    await createUser('  Mixed-Case-users-integration@Example.com  '.trim(), 'x', 'member');
    expect(await getUserByEmail('MIXED-CASE-USERS-INTEGRATION@EXAMPLE.COM')).not.toBeNull();
  });

  it('getUserByEmail returns null for a nonexistent user', async () => {
    expect(await getUserByEmail('nobody-users-integration@example.com')).toBeNull();
  });

  it('countAdmins only counts admin-role users', async () => {
    await createUser('admin-users-integration@example.com', 'x', 'admin');
    await createUser('member-users-integration@example.com', 'x', 'member');
    expect(await countAdmins()).toBeGreaterThanOrEqual(1);
  });

  it('deleteUser removes the row', async () => {
    const user = await createUser(TEST_EMAIL, 'x', 'member');
    await deleteUser(user.id);
    expect(await getUserById(user.id)).toBeNull();
  });
});
