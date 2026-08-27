const fs = require('fs');
const pool = require('./db');

async function seed() {
  try {
    const data = fs.readFileSync('ledger_export.csv', 'utf8').trim();
    const lines = data.split(/\r?\n/);
    if (lines.length <= 1) {
      console.log('CSV is empty or missing data rows.');
      process.exit(0);
    }

    // Map CSV header positions to indices
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const getIdx = (name) => headers.findIndex(h => h.toLowerCase() === name.toLowerCase());

    const dateIdx = getIdx('Date');
    const refIdx = getIdx('Reference');
    const grossIdx = getIdx('Gross');
    const feeIdx = getIdx('Processing_Fee');
    const netIdx = getIdx('Net_Deposit');

    let insertedCount = 0;

    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const cols = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
      
      const transaction_ref = cols[refIdx];
      const created_at = cols[dateIdx] || new Date();
      const gross_amount = parseFloat(cols[grossIdx]) || 0;
      const fee = parseFloat(cols[feeIdx]) || 0;
      const net_amount = parseFloat(cols[netIdx]) || 0;
      
      const channel = 'Web';
      const status = 'success';
      const customer_email = 'customer@transactpay.com';

      if (!transaction_ref) continue;

      await pool.query(
        `INSERT INTO transactions (transaction_ref, customer_email, channel, gross_amount, fee, net_amount, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamp, NOW()))
         ON CONFLICT (transaction_ref) DO NOTHING;`,
        [transaction_ref, customer_email, channel, gross_amount, fee, net_amount, status, created_at]
      );

      insertedCount++;
    }

    console.log(`SUCCESS: Seeding complete! Processed ${insertedCount} transactions.`);
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err.message);
    process.exit(1);
  }
}

seed();