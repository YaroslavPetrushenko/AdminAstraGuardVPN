const { Pool } = require("pg");
const { DATABASE_URL } = require("./config");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id BIGINT PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tickets (
      ticket_id TEXT PRIMARY KEY,
      user_id BIGINT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      assigned_admin BIGINT,
      notified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      ticket_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      admin_id BIGINT,
      text TEXT NOT NULL,
      delivered BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS promocodes (
      code TEXT PRIMARY KEY,
      discount INT NOT NULL,
      uses_left INT NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS promo_usage (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL,
      code TEXT NOT NULL,
      used_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, code)
    );
  `);

  console.log("[Admin DB] Schema initialized");
}

module.exports = {
  pool,
  initSchema,
};
