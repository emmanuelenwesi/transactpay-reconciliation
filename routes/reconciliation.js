const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

router.post('/upload', authenticateToken, upload.single('settlement_file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Please upload a valid CSV settlement file.' });
  }

  const merchantId = req.user.id || req.user.merchant_id;
  const parsedRecords = [];

  try {
    const stream = Readable.from(req.file.buffer);

    await new Promise((resolve, reject) => {
      stream
        .pipe(csv())
        .on('data', (row) => {
          const reference = row.reference || row.transaction_ref || row.Reference || row['TransactionRef'];
          const amount = parseFloat(row.amount || row.Gross || row.Amount || 0);

          if (reference) {
            parsedRecords.push({ reference: reference.trim(), amount });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    if (parsedRecords.length === 0) {
      return res.status(400).json({ error: 'CSV file contains no valid transaction rows.' });
    }

    let matchedCount = 0;
    let mismatchedCount = 0;
    let unmatchedCount = 0;
    const summary = [];

    for (const record of parsedRecords) {
      const txResult = await pool.query(
        `SELECT * FROM transactions 
         WHERE merchant_id = $1 AND (reference = $2 OR transaction_ref = $2)`,
        [merchantId, record.reference]
      );

      let matchStatus = 'UNMATCHED';

      if (txResult.rows.length > 0) {
        const dbTx = txResult.rows[0];
        const dbAmount = parseFloat(dbTx.gross_amount || dbTx.amount || 0);

        if (Math.abs(dbAmount - record.amount) < 0.01) {
          matchStatus = 'MATCHED';
          matchedCount++;
        } else {
          matchStatus = 'AMOUNT_MISMATCH';
          mismatchedCount++;
        }
      } else {
        unmatchedCount++;
      }

      await pool.query(
        `INSERT INTO pos_reconciliations (pos_reference, amount, match_status)
         VALUES ($1, $2, $3)
         ON CONFLICT (pos_reference) 
         DO UPDATE SET amount = EXCLUDED.amount, match_status = EXCLUDED.match_status, reconciled_at = NOW()`,
        [record.reference, record.amount, matchStatus]
      );

      summary.push({
        reference: record.reference,
        uploadedAmount: record.amount,
        matchStatus
      });
    }

    return res.status(200).json({
      message: 'Settlement file processed successfully.',
      stats: {
        totalProcessed: parsedRecords.length,
        matched: matchedCount,
        mismatched: mismatchedCount,
        unmatched: unmatchedCount
      },
      summary
    });
  } catch (err) {
    console.error('CSV Processing Error:', err);
    return res.status(500).json({ error: 'Failed to process settlement CSV file.' });
  }
});

// POST /api/reconciliation/resolve - Manually resolve a discrepancy
router.post('/resolve', authenticateToken, async (req, res) => {
  const { reconciliationId, transactionId, note } = req.body;
  const merchantId = req.user.id || req.user.merchant_id;

  if (!reconciliationId || !transactionId) {
    return res.status(400).json({ error: 'reconciliationId and transactionId are required.' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const recResult = await client.query(
      `SELECT * FROM pos_reconciliations WHERE id = $1`,
      [reconciliationId]
    );

    if (recResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Reconciliation record not found.' });
    }

    await client.query(
      `UPDATE pos_reconciliations 
       SET match_status = 'MANUALLY_MATCHED', 
           resolved_by = $1, 
           resolution_note = $2, 
           transaction_id = $3, 
           reconciled_at = NOW() 
       WHERE id = $4`,
      [merchantId, note || 'Manually resolved by merchant', transactionId, reconciliationId]
    );

    await client.query(
      `UPDATE transactions 
       SET status = 'settled' 
       WHERE id = $1 AND merchant_id = $2`,
      [transactionId, merchantId]
    );

    await client.query('COMMIT');
    return res.status(200).json({ message: 'Discrepancy resolved successfully.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Resolution Error:', err);
    return res.status(500).json({ error: 'Failed to resolve discrepancy.' });
  } finally {
    client.release();
  }
});

module.exports = router;
