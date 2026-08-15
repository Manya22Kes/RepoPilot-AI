const express = require('express');
const { listUsers, createUser, getUserByEmail, deleteUser, countAdmins, getUserById } = require('../db/users');
const { hashPassword } = require('../utils/passwords');
const { requireAdmin } = require('./auth');

const router = express.Router();

router.get('/users', requireAdmin, async (req, res, next) => {
  try {
    const users = await listUsers();
    res.json({ users });
  } catch (err) {
    next(err);
  }
});

router.post('/users', requireAdmin, async (req, res, next) => {
  try {
    const { email, password, role } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }
    if (role && !['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Role must be "admin" or "member"' });
    }

    const existing = await getUserByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser(email, passwordHash, role || 'member');
    return res.status(201).json({ user });
  } catch (err) {
    return next(err);
  }
});

router.delete('/users/:id', requireAdmin, async (req, res, next) => {
  try {
    const targetId = Number(req.params.id);
    const target = await getUserById(targetId);

    if (!target) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (targetId === req.user.userId) {
      return res.status(400).json({ error: "You can't delete your own account" });
    }
    if (target.role === 'admin') {
      const adminCount = await countAdmins();
      if (adminCount <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last remaining admin' });
      }
    }

    await deleteUser(targetId);
    return res.json({ deleted: true });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
