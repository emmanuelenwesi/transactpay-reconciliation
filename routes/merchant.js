const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { encrypt, decrypt } = require('../utils/crypto');

// GET /api/merchant/keys
router.get('/keys', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT secret_key, environment FROM merchants WHERE id = $1',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Merchant not found.' });
    }

    const merchant = result.rows[0];
    const decryptedKey = merchant.secret_key ? decrypt(merchant.secret_key) : '';

    const maskedKey = decryptedKey
      ? `${decryptedKey.substring(0, 10)}...${decryptedKey.slice(-4)}`
      : '';

    res.json({
      hasKey: Boolean(merchant.secret_key),
      maskedKey,
      environment: merchant.environment || 'sandbox'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve merchant keys.' });
  }
});

// POST /api/merchant/keys
router.post('/keys', authenticateToken, async (req, res) => {
  const { secretKey, environment } = req.body;

  if (!secretKey) {
    return res.status(400).json({ error: 'Secret Key is required.' });
  }

  try {
    const encResult = encrypt(secretKey);
    const encryptedKey = typeof encResult === 'object' ? encResult.encryptedData : encResult;

    await pool.query(
      `UPDATE merchants
       SET secret_key = $1, environment = $2, updated_at = NOW()
       WHERE id = $3`,
      [encryptedKey, environment || 'sandbox', req.user.id]
    );

    res.json({ status: 'success', message: 'TransactPay keys updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update credentials.' });
  }
});

module.exports = router;