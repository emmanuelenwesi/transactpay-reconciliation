const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'postgres_db',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'transactpay_user',
  password: process.env.DB_PASSWORD || 'SecurePassword123!',
  database: process.env.DB_NAME || 'reconciliation_db',
});

const initDb = async () => {
  let client;
  try {
    client = await pool.connect();

    // 1. Merchants Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS merchants (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255),
        role VARCHAR(50) DEFAULT 'Merchant Admin',
        secret_key TEXT,
        environment VARCHAR(50) DEFAULT 'sandbox',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE merchants ADD COLUMN IF NOT EXISTS password VARCHAR(255);`);
    await client.query(`ALTER TABLE merchants ADD COLUMN IF NOT EXISTS secret_key TEXT;`);

    // 2. Transactions Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        merchant_id INTEGER,
        transaction_ref VARCHAR(255),
        reference VARCHAR(255),
        customer_email VARCHAR(255),
        channel VARCHAR(50),
        gross_amount NUMERIC(12, 2),
        amount NUMERIC(12, 2),
        fee NUMERIC(12, 2) DEFAULT 0,
        net_amount NUMERIC(12, 2),
        status VARCHAR(50) DEFAULT 'successful',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS merchant_id INTEGER;`);
    await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS reference VARCHAR(255);`);
    await client.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS amount NUMERIC(12, 2);`);

    // 3. POS Reconciliations Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS pos_reconciliations (
        id SERIAL PRIMARY KEY,
        pos_reference VARCHAR(255) UNIQUE NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        match_status VARCHAR(50) NOT NULL,
        reconciled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (err) {
    // Suppress initialization errors
  } finally {
    if (client) client.release();
  }
};

initDb();

module.exports = pool;