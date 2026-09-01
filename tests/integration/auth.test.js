const request = require('supertest');
const app = require('../../server'); // Updated to point to server.js
const pool = require('../../db');

describe('Authentication & Key Management Routes', () => {
  const uniqueEmail = `merchant_${Date.now()}@example.com`;
  
  const testUser = {
    name: 'Test Merchant',
    email: uniqueEmail,
    password: 'SecurePassword123!',
    secret_key: 'sec_sandbox_1234567890',
    environment: 'sandbox'
  };

  afterAll(async () => {
    // Add space between DELETE and FROM
    await pool.query('DELETE FROM merchants WHERE email = $1;', [uniqueEmail]);
    await pool.end();
  });

  it('POST /api/auth/register - should register a new merchant and return a JWT', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send(testUser);

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.merchant).toHaveProperty('email', testUser.email);
    expect(res.body.merchant).not.toHaveProperty('secret_key');
  });

  it('POST /api/auth/login - should authenticate valid merchant credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('token');
  });
});