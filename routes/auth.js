const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { JWT_SECRET } = require('../middleware/auth');
const { encrypt } = require('../utils/crypto');

router.post('/register', async (req, res) => {
  const { name, email, password, role, secretKey, environment } = req.body;

  try {
    const userRole = role || 'Merchant Admin';
    let encryptedKey = null;

    if (secretKey) {
      const encResult = encrypt(secretKey);
      encryptedKey = typeof encResult === 'object' ? encResult.encryptedData : encResult;
    }

    const result = await pool.query(
      `INSERT INTO merchants (name, email, password, role, secret_key, environment)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email, role, environment`,
      [name, email, password, userRole, encryptedKey, environment || 'sandbox']
    );

    const merchant = result.rows[0];

    const token = jwt.sign(
      { id: merchant.id, email: merchant.email, role: merchant.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Merchant registered successfully',
      token,
      merchant: {
        id: merchant.id,
        name: merchant.name,
        email: merchant.email,
        role: merchant.role
      }
    });
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ error: 'Registration failed or email already exists.' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query('SELECT * FROM merchants WHERE email = $1', [email]);
    const merchant = result.rows[0];

    if (!merchant || merchant.password !== password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: merchant.id, email: merchant.email, role: merchant.role || 'Merchant Admin' },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token,
      merchant: {
        id: merchant.id,
        name: merchant.name,
        email: merchant.email,
        role: merchant.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Login server error' });
  }
});

module.exports = router;