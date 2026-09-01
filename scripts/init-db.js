const pool = require('../db');
const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
  try {
    const schemaPath = path.join(__dirname, '../schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      console.log('⚠️  schema.sql not found. Skipping schema initialization.');
      await pool.end();
      return;
    }

    const sql = fs.readFileSync(schemaPath, 'utf8');
    console.log('🔄 Executing database schema setup...');
    
    await pool.query(sql);
    
    console.log('✅ Database schema applied successfully.');
  } catch (err) {
    console.error('❌ Failed to initialize database schema:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

initializeDatabase();