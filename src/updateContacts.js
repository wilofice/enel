const { pool } = require('./db');
const config = require('./config');

const REFRESH_KEY = 'contactsRefreshedAt';

async function getLastRefresh() {
  const { rows } = await pool.query(
    `SELECT value FROM AppMeta WHERE key=$1`,
    [REFRESH_KEY]
  );
  return rows[0] ? new Date(rows[0].value) : null;
}

async function updateLastRefresh() {
  await pool.query(
    `INSERT INTO AppMeta(key, value) VALUES($1, $2)
     ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`,
    [REFRESH_KEY, new Date().toISOString()]
  );
}

async function shouldRefresh() {
  const frequencyDays = config.contactRefreshDays || 7;
  const last = await getLastRefresh();
  if (!last) return true;
  const diffMs = Date.now() - last.getTime();
  return diffMs > frequencyDays * 24 * 60 * 60 * 1000;
}

function normalizeContactNumber(waId) {
  if (!waId) return null;
  const atIndex = waId.indexOf('@');
  return atIndex === -1 ? waId : waId.slice(0, atIndex);
}

async function buildLastSentMap() {
  const map = new Map();
  try {
    const { rows } = await pool.query(
      `SELECT chatId, MAX(timestamp) AS last_sent
         FROM Messages
        WHERE fromMe = true
        GROUP BY chatId`
    );
    for (const row of rows) {
      map.set(row.chatid, Number(row.last_sent));
    }
  } catch (err) {
    console.error('Failed to build last-sent map', err.message);
  }
  return map;
}

async function refreshContacts(client) {
  try {
    console.log('Refreshing contacts from WhatsApp...');
    const contacts = await client.getContacts();
    let count = 0;
    const lastSentMap = await buildLastSentMap();
    for (const c of contacts) {
      const waId = c.id?._serialized || c.id;
      if (!waId || waId.endsWith('@g.us') || waId.endsWith('@newsletter') || waId === 'status@broadcast') continue;
      const name = c.pushname || c.name || null;
      const contactNumber = c.number || normalizeContactNumber(waId);
      const lastSentAt = lastSentMap.get(waId) || null;
      await pool.query(
        `INSERT INTO Contacts(id, name, contactNumber, lastSentAt) VALUES($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET
           name = COALESCE(EXCLUDED.name, Contacts.name),
           contactNumber = COALESCE(EXCLUDED.contactNumber, Contacts.contactNumber),
           lastSentAt = CASE
             WHEN EXCLUDED.lastSentAt IS NOT NULL THEN GREATEST(EXCLUDED.lastSentAt, Contacts.lastSentAt)
             ELSE Contacts.lastSentAt
           END`,
        [waId, name, contactNumber, lastSentAt]
      );
      count++;
    }
    await updateLastRefresh();
    console.log(`Contacts refreshed: ${count} contacts upserted.`);
  } catch (err) {
    console.error('Failed to refresh contacts:', err.message);
  }
}

module.exports = { refreshContacts, shouldRefresh };
