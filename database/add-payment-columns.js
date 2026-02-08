// Add merchant_bkash, merchant_nagad, payment_instructions columns to events table
// Run: node database/add-payment-columns.js

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });
const mysql = require('mysql2/promise');

async function migrate() {
  const config = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'defaultdb'
  };

  if (process.env.DB_SSL === 'true') {
    config.ssl = { rejectUnauthorized: false };
  }

  const conn = await mysql.createConnection(config);
  console.log('Connected to database');

  const queries = [
    // Add merchant numbers to events table
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS merchant_bkash VARCHAR(20) DEFAULT NULL`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS merchant_nagad VARCHAR(20) DEFAULT NULL`,
    `ALTER TABLE events ADD COLUMN IF NOT EXISTS payment_instructions TEXT DEFAULT NULL`,
    // Ensure payments table phone_number allows NULL (for manual payments where user might not provide)
    `ALTER TABLE payments MODIFY COLUMN phone_number VARCHAR(20) DEFAULT NULL`,
    // Add admin_notes column to payments for admin feedback
    `ALTER TABLE payments ADD COLUMN IF NOT EXISTS admin_notes TEXT DEFAULT NULL`
  ];

  for (const q of queries) {
    try {
      await conn.query(q);
      console.log('OK:', q.substring(0, 80) + '...');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME' || err.message.includes('Duplicate column')) {
        console.log('SKIP (already exists):', q.substring(0, 60));
      } else {
        console.error('ERROR:', err.message);
      }
    }
  }

  await conn.end();
  console.log('\nMigration complete!');
}

migrate().catch(err => { console.error('Migration failed:', err); process.exit(1); });
