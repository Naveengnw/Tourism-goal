// setup_db.js
require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false });

const sql = `
CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  comment TEXT NOT NULL,
  latitude FLOAT,
  longitude FLOAT,
  image_url TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS admin_users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);
`;

(async () => {
  try {
    await pool.query(sql);
    console.log('Tables created/verified.');
    await pool.end();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
