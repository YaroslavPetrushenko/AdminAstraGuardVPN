const { pool } = require("./db");

async function getAllPromocodes() {
  const res = await pool.query(`
    SELECT code, discount, uses_left
    FROM promocodes
    ORDER BY code ASC
  `);
  return res.rows;
}

async function createPromocode(code, discount, usesLeft) {
  const res = await pool.query(
    `
    INSERT INTO promocodes (code, discount, uses_left)
    VALUES ($1, $2, $3)
    ON CONFLICT (code) DO NOTHING
    RETURNING *
    `,
    [code, discount, usesLeft]
  );
  return res.rows[0] || null;
}

async function deletePromocode(code) {
  const res = await pool.query(
    `DELETE FROM promocodes WHERE code = $1 RETURNING *`,
    [code]
  );
  return res.rows[0] || null;
}

async function hasUserUsedPromo(userId, code) {
  const res = await pool.query(
    `
    SELECT 1 FROM promo_usage
    WHERE user_id = $1 AND code = $2
    LIMIT 1
    `,
    [userId, code]
  );
  return res.rowCount > 0;
}

async function markPromoUsed(userId, code) {
  await pool.query(
    `
    INSERT INTO promo_usage (user_id, code)
    VALUES ($1, $2)
    ON CONFLICT DO NOTHING
    `,
    [userId, code]
  );

  await pool.query(
    `
    UPDATE promocodes
    SET uses_left = uses_left - 1
    WHERE code = $1 AND uses_left > 0
    `,
    [code]
  );
}

async function getPromocode(code) {
  const res = await pool.query(
    `
    SELECT code, discount, uses_left
    FROM promocodes
    WHERE code = $1
    `,
    [code]
  );
  return res.rows[0] || null;
}

module.exports = {
  getAllPromocodes,
  createPromocode,
  deletePromocode,
  hasUserUsedPromo,
  markPromoUsed,
  getPromocode,
};
