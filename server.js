const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const initSyncCron = require('./jobs/syncCron');

const app = express();

if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// 1. Global Middleware Setup
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. Serve Static Assets
app.use(express.static(path.join(__dirname, 'public')));

// 3. Mount Modularized API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/merchant', require('./routes/merchant'));
app.use('/api/webhooks', require('./routes/webhooks'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api', require('./routes/sync'));
app.use('/api', require('./routes/reconciliation'));

// 4. Centralized Global Error Handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal Server Error' });
});

// 5. Initialize Background Tasks
initSyncCron();

// 6. Launch Server (Guarded for Jest Test Execution)
if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Reconciliation backend running securely on port ${PORT}`);
  });
}

module.exports = app;