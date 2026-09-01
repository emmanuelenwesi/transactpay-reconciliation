const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

router.get('/', authenticateToken, async (req, res) => {
  try {
    const merchantId = req.user.id || req.user.merchant_id;

    const result = await pool.query(
      'SELECT * FROM transactions WHERE merchant_id = $1',
      [merchantId]
    );

    return res.status(200).json(result.rows);
  } catch (err) {
    console.error('Fetch Transactions Error:', err);
    return res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

module.exports = router;