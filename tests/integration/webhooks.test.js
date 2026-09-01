const request = require('supertest');
const crypto = require('crypto');
const app = require('../../server');

describe('TransactPay Webhook Listener (POST /api/webhooks/transactpay)', () => {
  const secretKey = process.env.TRANSACTPAY_WEBHOOK_SECRET || 'test_webhook_secret_key';

  it('should accept and process a valid HMAC-signed webhook', async () => {
    const samplePayload = {
      event: 'charge.successful',
      data: {
        reference: 'TX-' + Date.now(),
        amount: 5000,
        fee: 100
      }
    };

    const payloadString = JSON.stringify(samplePayload);
    const signature = crypto
      .createHmac('sha256', secretKey)
      .update(payloadString)
      .digest('hex');

    const res = await request(app)
      .post('/api/webhooks/transactpay')
      .set('x-transactpay-signature', signature)
      .set('Content-Type', 'application/json')
      .send(samplePayload);

    expect(res.statusCode).toBe(200);
  });
});
