const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const pool = require('../db');

const WEBHOOK_SECRET = process.env.TRANSACTPAY_WEBHOOK_SECRET || 'test_webhook_secret_key';
const MAX_TIMESTAMP_AGE_SECONDS = 300; // 5 minutes

// POST /api/webhooks/transactpay - Handle inbound TransactPay events
router.post('/transactpay', express.json(), async (req, res) => {
  const signature = req.headers['x-transactpay-signature'];
  const timestamp = req.headers['x-transactpay-timestamp'];

  if (!signature || !timestamp) {
    return res.status(401).json({ error: 'Missing webhook signature or timestamp headers.' });
  }

  // 1. Validate Timestamp Freshness (Replay Attack Defense)
  const requestTimestamp = parseInt(timestamp, 10);
  const currentTimestamp = Math.floor(Date.now() / 1000);

  if (isNaN(requestTimestamp)) {
    return res.status(400).json({ error: 'Invalid timestamp header format.' });
  }

  const age = Math.abs(currentTimestamp - requestTimestamp);
  if (age > MAX_TIMESTAMP_AGE_SECONDS) {
    return res.status(401).json({ error: 'Webhook timestamp expired or outside tolerance window.' });
  }

  // 2. Validate HMAC Signature
  const rawPayload = `${timestamp}.${JSON.stringify(req.body)}`;
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawPayload)
    .digest('hex');

  const providedSigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSignature);

  if (
    providedSigBuffer.length !== expectedSigBuffer.length ||
    !crypto.timingSafeEqual(providedSigBuffer, expectedSigBuffer)
  ) {
    return res.status(401).json({ error: 'Invalid webhook signature.' });
  }

  // 3. Process Event Payload
  const { event, data } = req.body;

  try {
    if (event === 'charge.completed' || event === 'settlement.successful') {
      const { reference, gross_amount, status, merchant_id } = data;

      await pool.query(
        `INSERT INTO transactions (merchant_id, reference, gross_amount, status)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (reference) 
         DO UPDATE SET status = EXCLUDED.status`,
        [merchant_id || 1, reference, gross_amount || 0, status || 'settled']
      );
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('Webhook processing failure:', err);
    return res.status(500).json({ error: 'Internal server error processing webhook.' });
  }
});

module.exports = router;
