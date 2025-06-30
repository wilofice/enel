const { pool } = require('./db');

async function refreshContacts(client) {
  try {
    const contacts = await client.getContacts();
    for (const c of contacts) {
      const id = c.id?._serialized || c.id;
      const name = c.pushname || c.name || null;
      await pool.query(
        'INSERT INTO Contacts(id, name) VALUES($1, $2) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name',
        [id, name]
      );
    }
  } catch (err) {
    console.error('Failed to refresh contacts', err.message);
  }
}

module.exports = refreshContacts;
