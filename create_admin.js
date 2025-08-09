// create_admin.js
require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

const username = process.argv[2];
const password = process.argv[3];

if (!username || !password) {
  console.log('Usage: node create_admin.js <username> <password>');
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false });

(async () => {
  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      `INSERT INTO admin_users (username, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash;`,
      [username, hash]
    );
    console.log('Admin user created/updated.');
    await pool.end();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
