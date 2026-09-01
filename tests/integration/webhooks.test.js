const request = require('supertest');
const crypto = require('crypto');
const app = require('../../server');
const pool = require('../../db');

const WEBHOOK_SECRET = process.env.TRANSACTPAY_WEBHOOK_SECRET || 'test_webhook_secret_key';

describe('TransactPay Webhook Route - Security Hardening', () => {
  let merchantId;

  beforeAll(async () => {
    const merchantRes = await pool.query(
      `INSERT INTO merchants (name, email, password, environment) 
       VALUES ('Webhook Merchant', 'webhook@test.com', 'password123', 'test') 
       RETURNING id`
    );
    merchantId = merchantRes.rows[0].id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM transactions WHERE reference = $1', ['WH-REF-999']);
    await pool.query('DELETE FROM merchants WHERE id = $1', [merchantId]);
    await pool.end();
  });

  function generateHeaders(payload, timestampOverride) {
    const timestamp = timestampOverride || Math.floor(Date.now() / 1000);
    const rawPayload = `${timestamp}.${JSON.stringify(payload)}`;
    const signature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(rawPayload)
      .digest('hex');

    return {
      'x-transactpay-signature': signature,
      'x-transactpay-timestamp': timestamp.toString()
    };
  }

  it('POST /api/webhooks/transactpay - should accept valid webhook with fresh timestamp', async () => {
    const payload = {
      event: 'charge.completed',
      data: {
        reference: 'WH-REF-999',
        gross_amount: 1500.00,
        status: 'settled',
        merchant_id: merchantId
      }
    };

    const headers = generateHeaders(payload);

    const res = await request(app)
      .post('/api/webhooks/transactpay')
      .set(headers)
      .send(payload);

    expect(res.statusCode).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('POST /api/webhooks/transactpay - should reject webhook with missing headers', async () => {
    const res = await request(app)
      .post('/api/webhooks/transactpay')
      .send({ event: 'charge.completed' });

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('Missing webhook signature or timestamp headers');
  });

  it('POST /api/webhooks/transactpay - should reject expired timestamp (replay attack)', async () => {
    const payload = { event: 'charge.completed', data: { reference: 'REPLAY-001' } };
    const staleTimestamp = Math.floor(Date.now() / 1000) - 600; // 10 minutes ago
    const headers = generateHeaders(payload, staleTimestamp);

    const res = await request(app)
      .post('/api/webhooks/transactpay')
      .set(headers)
      .send(payload);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('Webhook timestamp expired');
  });

  it('POST /api/webhooks/transactpay - should reject invalid signature', async () => {
    const payload = { event: 'charge.completed', data: { reference: 'BAD-SIG' } };
    const timestamp = Math.floor(Date.now() / 1000);

    const res = await request(app)
      .post('/api/webhooks/transactpay')
      .set('x-transactpay-signature', 'invalid_signature_hash')
      .set('x-transactpay-timestamp', timestamp.toString())
      .send(payload);

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toContain('Invalid webhook signature');
  });
});
