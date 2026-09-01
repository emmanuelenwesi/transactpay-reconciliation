const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../db');

const WEBHOOK_SECRET = process.env.TRANSACTPAY_WEBHOOK_SECRET || 'test_webhook_secret_key';

router.post('/transactpay', async (req, res) => {
  const signature = req.headers['x-transactpay-signature'];

  if (!signature) {
    return res.status(401).json({ error: 'Missing signature header' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (signature !== expectedSignature) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  try {
    const { event, data } = req.body;

    if (event === 'charge.successful' && data) {
      const ref = data.reference || data.transaction_ref || `tx_${Date.now()}`;
      const amount = data.amount || data.gross_amount || 0;
      const fee = data.fee || 0;

      await pool.query(
        `INSERT INTO transactions (reference, transaction_ref, amount, gross_amount, fee, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [ref, ref, amount, amount, fee, 'SUCCESS']
      );
    }

    return res.status(200).json({ status: 'success', message: 'Webhook processed successfully' });
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(500).json({ error: 'Failed to process webhook' });
  }
});

module.exports = router;