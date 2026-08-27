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
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id SERIAL PRIMARY KEY,
        transaction_ref VARCHAR(255) UNIQUE NOT NULL,
        customer_email VARCHAR(255),
        channel VARCHAR(50),
        gross_amount NUMERIC(12, 2) NOT NULL,
        fee NUMERIC(12, 2) NOT NULL,
        net_amount NUMERIC(12, 2) NOT NULL,
        status VARCHAR(50) DEFAULT 'successful',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS pos_reconciliations (
        id SERIAL PRIMARY KEY,
        pos_reference VARCHAR(255) UNIQUE NOT NULL,
        amount NUMERIC(12, 2) NOT NULL,
        match_status VARCHAR(50) NOT NULL,
        reconciled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('PostgreSQL database schema initialized successfully.');
  } catch (err) {
    console.error('Error initializing PostgreSQL schema:', err.message);
  } finally {
    if (client) client.release();
  }
};

initDb();

module.exports = {
  query: (text, params) => pool.query(text, params),
  run: (text, params, callback) => {
    pool.query(text, params)
      .then(res => callback && callback(null, res))
      .catch(err => callback && callback(err));
  },
  all: (text, params, callback) => {
    pool.query(text, params)
      .then(res => callback && callback(null, res.rows))
      .catch(err => callback && callback(err));
  },
  get: (text, params, callback) => {
    pool.query(text, params)
      .then(res => callback && callback(null, res.rows[0]))
      .catch(err => callback && callback(err));
  }
};
