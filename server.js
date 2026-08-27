const cron = require('node-cron');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_cyber4rall';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for CSV Uploads
const upload = multer({ dest: 'uploads/' });
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// ==========================================
// JWT AUTHENTICATION MIDDLEWARE
// ==========================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token.' });
    }
    req.merchant = user; // Contains { merchant_id, email, name }
    next();
  });
};

// ==========================================
// 1. AUTHENTICATION & MERCHANT ROUTES
// ==========================================

// Merchant Registration
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, api_key, secret_key, environment } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  try {
    const existing = await pool.query('SELECT id FROM merchants WHERE email = $1;', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `INSERT INTO merchants (name, email, password_hash, api_key, secret_key, environment)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, environment, created_at;`,
      [name, email, password_hash, api_key || '', secret_key || '', environment || 'sandbox']
    );

    const merchant = result.rows[0];
    const token = jwt.sign(
      { merchant_id: merchant.id, email: merchant.email, name: merchant.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({ token, merchant });
  } catch (err) {
    console.error('Error during merchant registration:', err);
    res.status(500).json({ error: 'Failed to register merchant.' });
  }
});

// Merchant Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const result = await pool.query('SELECT * FROM merchants WHERE email = $1;', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const merchant = result.rows[0];
    const validPassword = await bcrypt.compare(password, merchant.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { merchant_id: merchant.id, email: merchant.email, name: merchant.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      merchant: {
        id: merchant.id,
        name: merchant.name,
        email: merchant.email,
        environment: merchant.environment
      }
    });
  } catch (err) {
    console.error('Error during merchant login:', err);
    res.status(500).json({ error: 'Server error during authentication.' });
  }
});

// Get Authenticated Merchant Profile
app.get('/api/merchant/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, api_key, environment, created_at FROM merchants WHERE id = $1;',
      [req.merchant.merchant_id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch merchant profile.' });
  }
});

// ==========================================
// 2. ISOLATED TRANSACTIONS & DASHBOARD
// ==========================================

// Get authenticated merchant's transactions ONLY
app.get('/api/transactions', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM transactions WHERE merchant_id = $1 ORDER BY created_at DESC;',
      [req.merchant.merchant_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching transactions:', err);
    res.status(500).json({ error: 'Failed to retrieve transactions.' });
  }
});

// Upload CSV scoped strictly to authenticated merchant
app.post('/api/upload', authenticateToken, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No CSV file uploaded.' });
  }

  const filePath = req.file.path;
  const results = [];

  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        let inserted = 0;
        const merchantId = req.merchant.merchant_id;

        for (const row of results) {
          const ref = row.reference || row.transaction_ref || row.ref;
          const email = row.customer_email || row.email || 'N/A';
          const channel = row.channel || 'Web';
          const gross = parseFloat(row.gross_amount || row.amount || 0);
          const fee = parseFloat(row.fee || 0);
          const net = parseFloat(row.net_amount || (gross - fee));
          const status = row.status || 'success';
          const createdAt = row.created_at || new Date();

          if (ref) {
            await pool.query(
              `INSERT INTO transactions (transaction_ref, customer_email, channel, gross_amount, fee, net_amount, status, merchant_id, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamp, NOW()))
               ON CONFLICT (transaction_ref) DO UPDATE SET
                  status = EXCLUDED.status,
                  gross_amount = EXCLUDED.gross_amount,
                  fee = EXCLUDED.fee,
                  net_amount = EXCLUDED.net_amount;`,
              [ref, email, channel, gross, fee, net, status, merchantId, createdAt]
            );
            inserted++;
          }
        }

        fs.unlinkSync(filePath);
        res.json({ message: `Successfully processed ${inserted} records for your account!` });
      } catch (err) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.status(500).json({ error: 'Failed to parse and insert CSV data.' });
      }
    })
    .on('error', (err) => {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      res.status(500).json({ error: 'Error reading uploaded CSV file.' });
    });
});

// ==========================================
// 3. SECURE TRANSACTPAY AUTOMATED API SYNC
// ==========================================

app.post('/api/sync-transactpay', authenticateToken, async (req, res) => {
  const merchantId = req.merchant.merchant_id;

  try {
    const merchantRes = await pool.query('SELECT * FROM merchants WHERE id = $1', [merchantId]);
    if (merchantRes.rows.length === 0) {
      return res.status(404).json({ error: 'Merchant record missing.' });
    }

    const { secret_key, environment } = merchantRes.rows[0];
    if (!secret_key) {
      return res.status(400).json({ error: 'No TransactPay Secret Key configured on account.' });
    }

    const baseUrl = environment === 'live'
      ? 'https://api.transactpay.ai/v1'
      : 'https://sandbox-api.transactpay.ai/v1';

    const tpResponse = await fetch(`${baseUrl}/transactions`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${secret_key}`,
        'Content-Type': 'application/json'
      }
    });

    if (!tpResponse.ok) {
      const errBody = await tpResponse.text();
      return res.status(tpResponse.status).json({ error: `TransactPay API Error: ${errBody}` });
    }

    const tpData = await tpResponse.json();
    const transactions = tpData.data || [];
    let inserted = 0;

    for (const tx of transactions) {
      const gross = parseFloat(tx.amount) || 0;
      const fee = parseFloat(tx.fee) || 0;
      const net = gross - fee;

      await pool.query(
        `INSERT INTO transactions (transaction_ref, customer_email, channel, gross_amount, fee, net_amount, status, merchant_id, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamp, NOW()))
         ON CONFLICT (transaction_ref) DO UPDATE SET
            status = EXCLUDED.status,
            gross_amount = EXCLUDED.gross_amount,
            fee = EXCLUDED.fee,
            net_amount = EXCLUDED.net_amount;`,
        [
          tx.reference || tx.id,
          tx.customer ? tx.customer.email : 'N/A',
          tx.channel || 'API',
          gross,
          fee,
          net,
          tx.status || 'success',
          merchantId,
          tx.created_at
        ]
      );
      inserted++;
    }

    res.json({ message: `Successfully synced ${inserted} transactions from TransactPay!` });
  } catch (err) {
    console.error('TransactPay Sync Error:', err);
    res.status(500).json({ error: 'Server error during API sync.' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Reconciliation backend running securely on port ${PORT}`);
});

// ==========================================
// AUTOMATED DAILY API SYNC CRON JOB (MIDNIGHT)
// ==========================================
cron.schedule('0 0 * * *', async () => {
  console.log('[CRON] Starting automated daily settlement sync for all merchants...');

  try {
    const merchants = await pool.query('SELECT id, secret_key, environment FROM merchants WHERE secret_key IS NOT NULL AND secret_key != \'\';');

    for (const merchant of merchants.rows) {
      const baseUrl = merchant.environment === 'live'
        ? 'https://api.transactpay.ai/v1'
        : 'https://sandbox-api.transactpay.ai/v1';

      try {
        const tpResponse = await fetch(`${baseUrl}/transactions`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${merchant.secret_key}`,
            'Content-Type': 'application/json'
          }
        });

        if (tpResponse.ok) {
          const tpData = await tpResponse.json();
          const transactions = tpData.data || [];

          for (const tx of transactions) {
            const gross = parseFloat(tx.amount) || 0;
            const fee = parseFloat(tx.fee) || 0;
            const net = gross - fee;

            await pool.query(
              `INSERT INTO transactions (transaction_ref, customer_email, channel, gross_amount, fee, net_amount, status, merchant_id, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamp, NOW()))
               ON CONFLICT (transaction_ref) DO UPDATE SET
                  status = EXCLUDED.status,
                  gross_amount = EXCLUDED.gross_amount,
                  fee = EXCLUDED.fee,
                  net_amount = EXCLUDED.net_amount;`,
              [tx.reference || tx.id, tx.customer ? tx.customer.email : 'N/A', tx.channel || 'API', gross, fee, net, tx.status || 'success', merchant.id, tx.created_at]
            );
          }
          console.log(`[CRON] Successfully synced merchant ID: ${merchant.id}`);
        }
      } catch (mErr) {
        console.error(`[CRON] Failed sync for merchant ID ${merchant.id}:`, mErr.message);
      }
    }
  } catch (err) {
    console.error('[CRON] Execution error:', err);
  }
});