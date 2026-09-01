const pool = require('../db');
const fs = require('fs');
const path = require('path');

async function initializeDatabase() {
  try {
    const schemaPath = path.join(__dirname, '../schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      console.log('⚠️ schema.sql not found.');
      await pool.end();
      return;
    }

    let sql = fs.readFileSync(schemaPath, 'utf8');
    
    // Strip single-line comments (-- comment) and block comments (/* comment */)
    sql = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

    // Split statements by semicolon
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    console.log(`🔄 Executing database schema setup (${statements.length} statements)...`);

    for (const statement of statements) {
      await pool.query(statement);
    }
    
    console.log('✅ Database schema applied successfully.');
    await pool.end();
  } catch (err) {
    console.error('❌ Database initialization error:', err.message);
    await pool.end();
    process.exit(1);
  }
}

initializeDatabase();
