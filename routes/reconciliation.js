const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const { Readable } = require('stream');
const PDFDocument = require('pdfkit');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// POST /api/reconciliation/upload - Upload and reconcile settlement CSV
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

// GET /api/reconciliation/export/csv - Export discrepancies as CSV
router.get('/export/csv', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pos_reference, amount, match_status, resolution_note, reconciled_at 
       FROM pos_reconciliations 
       WHERE match_status IN ('AMOUNT_MISMATCH', 'UNMATCHED', 'MANUALLY_MATCHED')
       ORDER BY reconciled_at DESC`
    );

    let csvContent = 'POS Reference,Amount,Match Status,Resolution Note,Reconciled At\n';
    result.rows.forEach(row => {
      const ref = `"${row.pos_reference || ''}"`;
      const amt = row.amount || 0;
      const status = `"${row.match_status || ''}"`;
      const note = `"${(row.resolution_note || '').replace(/"/g, '""')}"`;
      const date = `"${row.reconciled_at ? row.reconciled_at.toISOString() : ''}"`;
      csvContent += `${ref},${amt},${status},${note},${date}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="discrepancy_report.csv"');
    return res.status(200).send(csvContent);
  } catch (err) {
    console.error('CSV Export Error:', err);
    return res.status(500).json({ error: 'Failed to generate CSV export.' });
  }
});

// GET /api/reconciliation/export/pdf - Export discrepancies as PDF
router.get('/export/pdf', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT pos_reference, amount, match_status, resolution_note, reconciled_at 
       FROM pos_reconciliations 
       WHERE match_status IN ('AMOUNT_MISMATCH', 'UNMATCHED', 'MANUALLY_MATCHED')
       ORDER BY reconciled_at DESC`
    );

    const doc = new PDFDocument({ margin: 40 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="discrepancy_report.pdf"');

    doc.pipe(res);

    // Header
    doc.fontSize(20).text('TransactPay - Discrepancy Report', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).text(`Generated on: ${new Date().toUTCString()}`, { align: 'center' });
    doc.moveDown(1.5);

    // Summary Statistics
    const total = result.rows.length;
    doc.fontSize(12).text(`Total Discrepancies Recorded: ${total}`);
    doc.moveDown(1);

    // Table Content
    result.rows.forEach((row, i) => {
      doc.fontSize(10).text(
        `${i + 1}. Reference: ${row.pos_reference} | Amount: ${row.amount} | Status: ${row.match_status}`
      );
      if (row.resolution_note) {
        doc.fontSize(9).text(`   Note: ${row.resolution_note}`, { italic: true });
      }
      doc.moveDown(0.5);
    });

    doc.end();
  } catch (err) {
    console.error('PDF Export Error:', err);
    return res.status(500).json({ error: 'Failed to generate PDF export.' });
  }
});

module.exports = router;
