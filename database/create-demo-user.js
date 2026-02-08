const path = require('path');
module.paths.unshift(path.join(__dirname, '..', 'backend', 'node_modules'));

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

async function createDemoUser() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false }
  });

  const hash = await bcrypt.hash('user123', 10);

  // Check if demo user already exists
  const [existing] = await pool.query("SELECT id FROM users WHERE email = 'user@tourvista.com'");
  if (existing.length > 0) {
    await pool.query('UPDATE users SET password = ? WHERE email = ?', [hash, 'user@tourvista.com']);
    console.log('✅ Demo user password updated');
  } else {
    await pool.query(
      "INSERT INTO users (first_name, last_name, email, password, role, status, avatar) VALUES (?, ?, ?, ?, 'participant', 'active', 'DU')",
      ['Demo', 'User', 'user@tourvista.com', hash]
    );
    console.log('✅ Demo user created');
  }

  const [users] = await pool.query('SELECT id, first_name, last_name, email, role FROM users');
  console.table(users);

  await pool.end();
}

createDemoUser().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
