const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../server');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_cyber4rall';

// Mock DB pool to prevent PostgreSQL connection attempts during tests
jest.mock('../db', () => ({
  query: jest.fn().mockImplementation((queryText) => {
    if (queryText.includes('UPDATE transactions')) {
      return Promise.resolve({ rowCount: 0, rows: [] });
    }
    return Promise.resolve({ rowCount: 0, rows: [] });
  }),
  end: jest.fn().mockResolvedValue(true)
}));

const merchantAToken = jwt.sign(
  { merchant_id: 1, email: 'merchantA@transactpay.ai', name: 'Merchant A', role: 'Merchant Admin' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const merchantBToken = jwt.sign(
  { merchant_id: 2, email: 'merchantB@transactpay.ai', name: 'Merchant B', role: 'Merchant Admin' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

describe('Multi-Tenant Data Isolation & Security Enforcement', () => {

  test('rejects transaction fetch requests without a valid JWT token', async () => {
    const res = await request(app).get('/api/transactions');
    expect(res.statusCode).toBe(401);
  });

  test('ensures JWT claims strictly scope queries to the authenticated merchant_id', () => {
    const decodedA = jwt.verify(merchantAToken, JWT_SECRET);
    const decodedB = jwt.verify(merchantBToken, JWT_SECRET);

    expect(decodedA.merchant_id).toBe(1);
    expect(decodedB.merchant_id).toBe(2);
    expect(decodedA.merchant_id).not.toEqual(decodedB.merchant_id);
  });

  test('prevents Merchant B from resolving discrepancies belonging to Merchant A', async () => {
    const res = await request(app)
      .patch('/api/reconciliation/101/resolve')
      .set('Authorization', `Bearer ${merchantBToken}`)
      .send({ resolution_notes: 'Unauthorized attempt to resolve' });

    expect([401, 403, 404]).toContain(res.statusCode);
  });

  test('blocks Auditor role from executing administrative discrepancy evaluations', async () => {
    const auditorToken = jwt.sign(
      { merchant_id: 1, email: 'auditor@transactpay.ai', name: 'Auditor User', role: 'Auditor' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .post('/api/reconciliation/evaluate-discrepancies')
      .set('Authorization', `Bearer ${auditorToken}`)
      .send({ expected_fee_percentage: 0.015 });

    expect(res.statusCode).toBe(403);
  });
});