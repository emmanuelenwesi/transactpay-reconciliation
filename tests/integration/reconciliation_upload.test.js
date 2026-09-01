const request = require('supertest');
const app = require('../../server');
const pool = require('../../db');

describe('POS & Bank Settlement File Upload Integration', () => {
  let authToken;
  const testRef = 'TX_SETTLE_' + Date.now();

  beforeAll(async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'CSV Test Merchant',
        email: 'csvtest_' + Date.now() + '@merchant.com',
        password: 'password123'
      });

    authToken = regRes.body.token;
    const merchantId = regRes.body.merchant?.id || regRes.body.id;

    await pool.query(
      "INSERT INTO transactions (merchant_id, reference, gross_amount, status) VALUES ($1, $2, 150.00, 'SUCCESS')",
      [merchantId, testRef]
    );
  });

  afterAll(async () => {
    await pool.end();
  });

  it('should accept a CSV upload, match against existing transactions, and return summary', async () => {
    const sampleCsvContent = `reference,amount\n${testRef},150.00\nTX_MISSING_9999,500.00`;

    const res = await request(app)
      .post('/api/reconciliation/upload')
      .set('Authorization', 'Bearer ' + authToken)
      .attach('settlement_file', Buffer.from(sampleCsvContent), 'settlement.csv');

    expect(res.statusCode).toBe(200);
  });
});