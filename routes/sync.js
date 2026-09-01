const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });
const pool = require('../db');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');


// POST /api/sync-transactpay
router.post('/sync-transactpay', authenticateToken, async (req, res) => {
  try {
    const merchantId = req.user.id;

    // 1. Fetch merchant credentials from DB
    const merchantQuery = await db.query(
      'SELECT encrypted_secret_key, key_iv, key_auth_tag, environment FROM merchants WHERE id = $1',
      [merchantId]
    );

    const merchant = merchantQuery.rows[0];
    if (!merchant || !merchant.encrypted_secret_key) {
      return res.status(400).json({ error: 'TransactPay API key is not configured.' });
    }

    // 2. Decrypt secret key
    const secretKey = decrypt(
      merchant.encrypted_secret_key,
      merchant.key_iv,
      merchant.key_auth_tag
    );

    // 3. Determine base API URL according to environment
    const baseUrl = merchant.environment === 'production'
      ? 'https://api.transactpay.ai/v1'
      : 'https://sandbox.transactpay.ai/v1';

    // 4. Fetch transactions from TransactPay API
    const response = await fetch(`${baseUrl}/transactions`, {
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`TransactPay API responded with status ${response.status}`);
    }

    const { data: remoteTransactions } = await response.json();
    let syncedCount = 0;

    // 5. Upsert transactions into local database
    for (const tx of remoteTransactions) {
      const queryText = `
        INSERT INTO transactions (
          merchant_id, reference, amount, fee, net, status, gateway_created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (reference) DO UPDATE SET
          amount = EXCLUDED.amount,
          fee = EXCLUDED.fee,
          net = EXCLUDED.net,
          status = EXCLUDED.status,
          updated_at = CURRENT_TIMESTAMP;
      `;

      const values = [
        merchantId,
        tx.reference || tx.id,
        tx.amount,
        tx.fee || 0,
        tx.amount - (tx.fee || 0),
        tx.status || 'PENDING',
        tx.created_at || new Date()
      ];

      await db.query(queryText, values);
      syncedCount++;
    }

    return res.status(200).json({
      message: `Successfully synced ${syncedCount} transactions from TransactPay.`,
      syncedCount
    });
  } catch (error) {
    console.error('Sync Error:', error);
    return res.status(500).json({ error: error.message || 'Failed to sync with TransactPay' });
  }
});

module.exports = router;