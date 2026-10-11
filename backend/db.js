require('dotenv').config();
const { Pool } = require('pg');
const options = process.env.DATABASE_URL ? { connectionString: process.env.DATABASE_URL } : {
  host: process.env.DB_HOST || 'localhost', port: Number(process.env.DB_PORT || 5432),
  user: process.env.DB_USER || 'urluser', password: process.env.DB_PASSWORD || 'urlpassword',
  database: process.env.DB_NAME || 'urlshortener'
};
if (process.env.DB_SSL === 'true') options.ssl = { rejectUnauthorized: false };
const pool = new Pool(options);
async function initDb() {
  await pool.query(`CREATE TABLE IF NOT EXISTS urls (
    id BIGSERIAL PRIMARY KEY,
    short_code VARCHAR(32) UNIQUE NOT NULL,
    original_url TEXT NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query('CREATE INDEX IF NOT EXISTS urls_expires_at_idx ON urls (expires_at)');
}
module.exports = { pool, initDb };
