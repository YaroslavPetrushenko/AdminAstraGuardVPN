const { pool } = require("./db");

async function getTicketsByStatus(status = "open", limit = 20) {
  const res = await pool.query(
    `
    SELECT t.ticket_id,
           t.user_id,
           t.status,
           t.assigned_admin,
           t.created_at,
           t.updated_at,
           u.username,
           u.first_name,
           u.last_name,
           COUNT(m.id) AS messages_count
    FROM tickets t
    LEFT JOIN users u ON u.user_id = t.user_id
    LEFT JOIN messages m ON m.ticket_id = t.ticket_id
    WHERE t.status = $1
    GROUP BY t.ticket_id, u.username, u.first_name, u.last_name
    ORDER BY t.updated_at DESC
    LIMIT $2
    `,
    [status, limit]
  );
  return res.rows;
}

async function getTicket(ticketId) {
  const res = await pool.query(
    `
    SELECT t.ticket_id,
           t.user_id,
           t.status,
           t.assigned_admin,
           t.created_at,
           t.updated_at,
           u.username,
           u.first_name,
           u.last_name
    FROM tickets t
    LEFT JOIN users u ON u.user_id = t.user_id
    WHERE t.ticket_id = $1
    `,
    [ticketId]
  );
  return res.rows[0] || null;
}

async function getTicketMessages(ticketId) {
  const res = await pool.query(
    `
    SELECT id, sender, admin_id, text, created_at
    FROM messages
    WHERE ticket_id = $1
    ORDER BY created_at ASC
    `,
    [ticketId]
  );
  return res.rows;
}

async function assignTicket(ticketId, adminId) {
  const res = await pool.query(
    `
    UPDATE tickets
    SET assigned_admin = $1, updated_at = NOW()
    WHERE ticket_id = $2
      AND (assigned_admin IS NULL OR assigned_admin = $1)
    RETURNING *
    `,
    [adminId, ticketId]
  );
  return res.rows[0] || null;
}

async function freeTicket(ticketId, adminId) {
  const res = await pool.query(
    `
    UPDATE tickets
    SET assigned_admin = NULL, updated_at = NOW()
    WHERE ticket_id = $1 AND assigned_admin = $2
    RETURNING *
    `,
    [ticketId, adminId]
  );
  return res.rows[0] || null;
}

async function closeTicket(ticketId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`DELETE FROM messages WHERE ticket_id = $1`, [ticketId]);
    const res = await client.query(
      `DELETE FROM tickets WHERE ticket_id = $1 RETURNING *`,
      [ticketId]
    );

    await client.query("COMMIT");
    return res.rows[0] || null;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function addAdminMessage(ticketId, adminId, text) {
  const res = await pool.query(
    `
    INSERT INTO messages (ticket_id, sender, admin_id, text)
    VALUES ($1, 'admin', $2, $3)
    RETURNING *
    `,
    [ticketId, adminId, text]
  );

  await pool.query(
    `UPDATE tickets SET updated_at = NOW() WHERE ticket_id = $1`,
    [ticketId]
  );

  return res.rows[0];
}

async function getNewTicketsForNotify() {
  const res = await pool.query(`
    SELECT t.ticket_id, t.user_id, u.username, u.first_name, u.last_name
    FROM tickets t
    LEFT JOIN users u ON u.user_id = t.user_id
    WHERE t.notified = FALSE
  `);
  return res.rows;
}

async function markTicketNotified(ticketId) {
  await pool.query(
    `UPDATE tickets SET notified = TRUE WHERE ticket_id = $1`,
    [ticketId]
  );
}

module.exports = {
  getTicketsByStatus,
  getTicket,
  getTicketMessages,
  assignTicket,
  freeTicket,
  closeTicket,
  addAdminMessage,
  getNewTicketsForNotify,
  markTicketNotified,
};
