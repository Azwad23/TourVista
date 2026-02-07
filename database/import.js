// Script to import schema-cloud.sql into Aiven MySQL
const path = require('path');

// Add backend's node_modules so we can use mysql2
module.paths.unshift(path.join(__dirname, '..', 'backend', 'node_modules'));

const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', 'backend', '.env') });

async function importSchema() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: { rejectUnauthorized: false },
    multipleStatements: true
  });

  console.log('✅ Connected to Aiven MySQL');

  const sql = fs.readFileSync(path.join(__dirname, 'schema-cloud.sql'), 'utf8');
  
  // Remove comment-only lines and split by semicolons
  const cleanSql = sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');
  
  const statements = cleanSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  console.log(`📄 Found ${statements.length} SQL statements to execute\n`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.substring(0, 60).replace(/\n/g, ' ');
    try {
      await connection.query(stmt);
      console.log(`  ✅ [${i + 1}/${statements.length}] ${preview}...`);
    } catch (err) {
      console.log(`  ❌ [${i + 1}/${statements.length}] ${preview}...`);
      console.log(`     Error: ${err.message}`);
    }
  }

  // Verify
  const [tables] = await connection.query('SHOW TABLES');
  console.log(`\n🎉 Done! ${tables.length} tables in database:`);
  tables.forEach(t => console.log(`   - ${Object.values(t)[0]}`));

  await connection.end();
}

importSchema().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
