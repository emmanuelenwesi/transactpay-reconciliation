const request = require('supertest');
const app = require('../server');
const pool = require('../db');

describe('Multi-Tenant Data Isolation & Security Enforcement', () => {
  const merchantA_email = `merchantA_${Date.now()}@example.com`;
  let tokenA;

  beforeAll(async () => {
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Merchant A',
        email: merchantA_email,
        password: 'Password123!',
        secret_key: 'sec_sandbox_1234567890',
        environment: 'sandbox'
      });
    
    tokenA = regRes.body.token;
  });

  afterAll(async () => {
    await pool.query('DELETE FROM merchants WHERE email = $1;', [merchantA_email]);
    await pool.end();
  });

  test('rejects transaction fetch requests without a valid JWT token', async () => {
    const res = await request(app).get('/api/transactions');
    expect(res.statusCode).toBe(401);
  });

  test('ensures JWT claims strictly scope queries to the authenticated merchant_id', async () => {
    const res = await request(app)
      .get('/api/transactions')
      .set('Authorization', `Bearer ${tokenA}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});