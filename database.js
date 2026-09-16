require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER || "urluser",
  password: process.env.DB_PASSWORD || "urlpassword",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || "urlshortener",
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false
});

async function createTable() {
  try {
    await pool.query(`CREATE SEQUENCE IF NOT EXISTS url_id_seq;`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS urls (
        id BIGINT PRIMARY KEY,
        short_code VARCHAR(20) UNIQUE NOT NULL,
        original_url TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      SELECT setval(
        'url_id_seq',
        COALESCE((SELECT MAX(id) FROM urls), 0) + 1,
        false
      );
    `);

    console.log("URLs table is ready!");
  } catch (error) {
    console.error("Database error:", error.message);
  }
}

createTable();

module.exports = pool;
