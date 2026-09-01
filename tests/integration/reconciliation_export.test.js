const request = require('supertest');
const app = require('../../server');
const pool = require('../../db');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../../middleware/auth');

describe('Reconciliation Export Routes', () => {
  let token;
  let merchantId;

  beforeAll(async () => {
    const merchantRes = await pool.query(
      `INSERT INTO merchants (name, email, password, environment) 
       VALUES ('Export Merchant', 'export@test.com', 'password123', 'test') 
       RETURNING id`
    );
    merchantId = merchantRes.rows[0].id;

    token = jwt.sign(
      { id: merchantId, merchant_id: merchantId, email: 'export@test.com' },
      JWT_SECRET
    );

    await pool.query(
      `INSERT INTO pos_reconciliations (pos_reference, amount, match_status, resolution_note) 
       VALUES ('EXP-REF-001', 1250.00, 'AMOUNT_MISMATCH', 'Overcharge flagged')`
    );
  });

  afterAll(async () => {
    await pool.query('DELETE FROM pos_reconciliations WHERE pos_reference = $1', ['EXP-REF-001']);
    await pool.query('DELETE FROM merchants WHERE id = $1', [merchantId]);
    await pool.end();
  });

  it('GET /api/reconciliation/export/csv - should return CSV file header and data', async () => {
    const res = await request(app)
      .get('/api/reconciliation/export/csv')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('POS Reference,Amount,Match Status');
    expect(res.text).toContain('EXP-REF-001');
  });

  it('GET /api/reconciliation/export/pdf - should return PDF binary document', async () => {
    const res = await request(app)
      .get('/api/reconciliation/export/pdf')
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });
});
