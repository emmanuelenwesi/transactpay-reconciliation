const db = require('../db');

beforeAll(async () => {
  // 1. Create merchants table
  await db.query(`
    CREATE TABLE IF NOT EXISTS merchants (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      encrypted_secret_key TEXT,
      key_iv TEXT,
      key_auth_tag TEXT,
      environment VARCHAR(50) DEFAULT 'sandbox',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Create transactions table
  await db.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      merchant_id INT REFERENCES merchants(id) ON DELETE CASCADE,
      reference VARCHAR(255) UNIQUE NOT NULL,
      amount NUMERIC(12, 2) NOT NULL,
      fee NUMERIC(12, 2) DEFAULT 0.00,
      expected_fee NUMERIC(12, 2) DEFAULT 0.00,
      fee_difference NUMERIC(12, 2) DEFAULT 0.00,
      net NUMERIC(12, 2) NOT NULL,
      status VARCHAR(50) DEFAULT 'PENDING',
      resolution_notes TEXT,
      gateway_created_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 3. Create audit_logs table
  await db.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id SERIAL PRIMARY KEY,
      merchant_id INT REFERENCES merchants(id) ON DELETE CASCADE,
      action VARCHAR(100) NOT NULL,
      details JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
});

afterEach(async () => {
  // Clear tables with CASCADE to wipe child data without FK constraint errors
  await db.query('TRUNCATE merchants, transactions, audit_logs CASCADE;');
});

afterAll(async () => {
  // Close database connection pool
  await db.end();
});