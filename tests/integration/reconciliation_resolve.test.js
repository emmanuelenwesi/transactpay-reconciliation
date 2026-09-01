const request = require('supertest');
const app = require('../../server');
const pool = require('../../db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../middleware/auth');

describe('Manual Discrepancy Resolution Route', () => {
  let token;
  let merchantId;
  let transactionId;
  let reconciliationId;

  beforeAll(async () => {
    const merchantRes = await pool.query(
      `INSERT INTO merchants (name, email, password, environment) 
       VALUES ('Resolve Merchant', 'resolve@test.com', 'password123', 'test') 
       RETURNING id`
    );
    merchantId = merchantRes.rows[0].id;

    const payload = {
      id: merchantId,
      merchant_id: merchantId,
      email: 'resolve@test.com'
    };

    token = jwt.sign(payload, JWT_SECRET);

    const txRes = await pool.query(
      `INSERT INTO transactions (merchant_id, reference, gross_amount, status) 
       VALUES ($1, 'REF-100', 5000.00, 'discrepancy') 
       RETURNING id`,
      [merchantId]
    );
    transactionId = txRes.rows[0].id;

    const recRes = await pool.query(
      `INSERT INTO pos_reconciliations (pos_reference, amount, match_status) 
       VALUES ('REF-100', 4900.00, 'AMOUNT_MISMATCH') 
       RETURNING id`
    );
    reconciliationId = recRes.rows[0].id;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM pos_reconciliations WHERE pos_reference = $1', ['REF-100']);
    await pool.query('DELETE FROM transactions WHERE reference = $1', ['REF-100']);
    await pool.query('DELETE FROM merchants WHERE id = $1', [merchantId]);
    await pool.end();
  });

  it('POST /api/reconciliation/resolve - should resolve a discrepancy successfully', async () => {
    const res = await request(app)
      .post('/api/reconciliation/resolve')
      .set('Authorization', `Bearer ${token}`)
      .send({
        reconciliationId,
        transactionId,
        note: 'Bank fee variance accepted'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body.message).toContain('resolved successfully');
  });
});
