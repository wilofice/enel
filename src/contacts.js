const { pool } = require('./db');

async function getContactName(id) {
  if (!id) return null;
  try {
    const res = await pool.query('SELECT name FROM Contacts WHERE id=$1', [id]);
    return res.rowCount ? res.rows[0].name : null;
  } catch (err) {
    console.error('Failed to fetch contact name', err.message);
    return null;
  }
}

module.exports = { getContactName };
