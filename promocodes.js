const { pool } = require("./db");

// Получить промокод
async function getPromocode(code) {
  const res = await pool.query(
    `
    SELECT code, discount, uses_left
    FROM promocodes
    WHERE code = $1;
    `,
    [code]
  );
  return res.rows[0] || null;
}

// Проверить, использовал ли пользователь
async function hasUserUsedPromo(userId, code) {
  const res = await pool.query(
    `
    SELECT id
    FROM promo_usages
    WHERE user_id = $1
      AND code = $2
    LIMIT 1;
    `,
    [userId, code]
  );
  return res.rows.length > 0;
}

// Отметить использование промокода
async function markPromoUsed(userId, code) {
  await pool.query("BEGIN");

  try {
    const promoRes = await pool.query(
      `
      SELECT code, uses_left
      FROM promocodes
      WHERE code = $1
      FOR UPDATE;
      `,
      [code]
    );

    const promo = promoRes.rows[0];
    if (!promo || promo.uses_left <= 0) {
      await pool.query("ROLLBACK");
      return null;
    }

    await pool.query(
      `
      INSERT INTO promo_usages (user_id, code)
      VALUES ($1, $2)
      ON CONFLICT (user_id, code) DO NOTHING;
      `,
      [userId, code]
    );

    const usageRes = await pool.query(
      `
      SELECT id
      FROM promo_usages
      WHERE user_id = $1
        AND code = $2;
      `,
      [userId, code]
    );

    if (!usageRes.rows.length) {
      await pool.query("ROLLBACK");
      return null;
    }

    await pool.query(
      `
      UPDATE promocodes
      SET uses_left = uses_left - 1
      WHERE code = $1;
      `,
      [code]
    );

    await pool.query("COMMIT");
    return true;
  } catch (e) {
    await pool.query("ROLLBACK");
    throw e;
  }
}

// Админ: все промокоды
async function getAllPromocodes() {
  const res = await pool.query(
    `
    SELECT code, discount, uses_left, created_at
    FROM promocodes
    ORDER BY created_at DESC;
    `
  );
  return res.rows;
}

// Админ: создать промокод
async function createPromocode(code, discount, usesLeft) {
  const res = await pool.query(
    `
    INSERT INTO promocodes (code, discount, uses_left)
    VALUES ($1, $2, $3)
    ON CONFLICT (code) DO NOTHING
    RETURNING *;
    `,
    [code, discount, usesLeft]
  );
  return res.rows[0] || null;
}

// Админ: удалить промокод
async function deletePromocode(code) {
  const res = await pool.query(
    `
    DELETE FROM promocodes
    WHERE code = $1
    RETURNING *;
    `,
    [code]
  );
  return res.rows[0] || null;
}

module.exports = {
  getPromocode,
  hasUserUsedPromo,
  markPromoUsed,

  getAllPromocodes,
  createPromocode,
  deletePromocode,
};
