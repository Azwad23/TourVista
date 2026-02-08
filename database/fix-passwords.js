const path = require('path');
module.paths.unshift(path.join(__dirname, '..', 'backend', 'node_modules'));

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

async function fixPasswords() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
  });

  // Hash passwords properly
  const adminHash = await bcrypt.hash('admin123', 10);
  const userHash = await bcrypt.hash('pass123', 10);

  // Verify the hash works
  const verified = await bcrypt.compare('admin123', adminHash);
  console.log('Hash verification:', verified ? 'OK' : 'FAILED');

  // Update admin password
  await pool.query('UPDATE users SET password = ? WHERE email = ?', [adminHash, 'admin@tourvista.com']);
  console.log('✅ Admin password set (admin@tourvista.com / admin123)');

  // Update all participant passwords
  await pool.query("UPDATE users SET password = ? WHERE role = 'participant'", [userHash]);
  console.log('✅ All participant passwords set (pass123)');

  // Show all users
  const [users] = await pool.query('SELECT id, first_name, last_name, email, role FROM users');
  console.table(users);

  await pool.end();
}

fixPasswords().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
