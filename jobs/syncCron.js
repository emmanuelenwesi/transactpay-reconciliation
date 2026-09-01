const cron = require('node-cron');
const pool = require('../db'); // Reuses your central database connection pool

const initSyncCron = () => {
  // Prevent background timers from triggering during test runs
  if (process.env.NODE_ENV === 'test') return;

  // Cron Syntax: '0 0 * * *' = Runs every day at 00:00 (Midnight)
  cron.schedule('0 0 * * *', async () => {
    console.log('[CRON] Starting automated daily settlement sync for all merchants...');
    
    try {
      // Fetch all merchants with registered TransactPay API keys
      const merchants = await pool.query(
        "SELECT id, secret_key, environment FROM merchants WHERE secret_key IS NOT NULL AND secret_key != ''"
      );

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

              // Upsert (Insert or Update if reference exists)
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
                  tx.customer?.email || 'N/A', 
                  tx.channel || 'API', 
                  gross, 
                  fee, 
                  net, 
                  tx.status || 'success', 
                  merchant.id, 
                  tx.created_at
                ]
              );
            }
            console.log(`[CRON] Successfully synced transactions for merchant ID: ${merchant.id}`);
          }
        } catch (mErr) {
          console.error(`[CRON] Error syncing merchant ID ${merchant.id}:`, mErr.message);
        }
      }
    } catch (err) {
      console.error('[CRON] Database query failed during sync schedule:', err);
    }
  });
};

module.exports = initSyncCron;