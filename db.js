const { Pool } = require("pg");
const { DATABASE_URL } = require("./config");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.PGSSL === "disable" ? false : { rejectUnauthorized: false },
});

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id BIGINT PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tickets (
      ticket_id TEXT PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'open',
      assigned_admin BIGINT,
      notified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      ticket_id TEXT NOT NULL REFERENCES tickets(ticket_id) ON DELETE CASCADE,
      sender TEXT NOT NULL,
      text TEXT NOT NULL,
      admin_id BIGINT,
      delivered BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS promocodes (
      code TEXT PRIMARY KEY,
      discount INTEGER NOT NULL,
      uses_left INTEGER NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS promo_usages (
      id SERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      code TEXT NOT NULL REFERENCES promocodes(code) ON DELETE CASCADE,
      used_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, code)
    );
  `);

  console.log("[DB] Схема инициализирована");
}

module.exports = {
  pool,
  initSchema,
};
