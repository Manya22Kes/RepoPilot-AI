const pool = require('./pool');

// Postgres returns BIGSERIAL/BIGINT columns as strings by default (to
// avoid precision loss outside JS's safe integer range), but code that
// compares user IDs (e.g. the self-delete guard) needs a real Number —
// normalizing here, once, is safer than remembering to cast at every
// call site.
function normalizeId(row) {
  return row ? { ...row, id: Number(row.id) } : row;
}

async function createUser(email, passwordHash, role = 'member') {
  const { rows } = await pool.query(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, $3) RETURNING id, email, role, created_at`,
    [email.toLowerCase().trim(), passwordHash, role]
  );
  return normalizeId(rows[0]);
}

async function getUserByEmail(email) {
  const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase().trim()]);
  return normalizeId(rows[0]) || null;
}

async function getUserById(id) {
  const { rows } = await pool.query('SELECT id, email, role, created_at FROM users WHERE id = $1', [id]);
  return normalizeId(rows[0]) || null;
}

async function listUsers() {
  const { rows } = await pool.query('SELECT id, email, role, created_at FROM users ORDER BY id');
  return rows.map(normalizeId);
}

async function countUsers() {
  const { rows } = await pool.query('SELECT count(*) FROM users');
  return Number(rows[0].count);
}

async function countAdmins() {
  const { rows } = await pool.query("SELECT count(*) FROM users WHERE role = 'admin'");
  return Number(rows[0].count);
}

async function deleteUser(id) {
  await pool.query('DELETE FROM users WHERE id = $1', [id]);
}

module.exports = { createUser, getUserByEmail, getUserById, listUsers, countUsers, countAdmins, deleteUser };
