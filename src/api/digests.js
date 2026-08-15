const express = require('express');
const { listDigestSnapshots } = require('../db/digestSnapshots');

const router = express.Router();

router.get('/digests', async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const digests = await listDigestSnapshots(limit);
    res.json({ digests });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
