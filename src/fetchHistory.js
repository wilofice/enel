const { pool } = require('./db');
const { logMessageDetails } = require('./messageLogger');

function normalizeChatId(chat) {
  if (!chat) return null;
  return chat.id?._serialized || chat.id || null;
}

function shouldSkipChat(chat) {
  const id = normalizeChatId(chat);
  if (!id) return true;
  if (chat.isGroup) return true;
  if (id.endsWith('@g.us')) return true;
  if (id.endsWith('@newsletter')) return true;
  if (id === 'status@broadcast') return true;
  return false;
}

async function upsertContact(chat) {
  if (shouldSkipChat(chat)) return;
  const id = normalizeChatId(chat);
  const displayName =
    (chat.contact && (chat.contact.pushname || chat.contact.name)) ||
    chat.name ||
    chat.formattedTitle ||
    null;
  try {
    await pool.query(
      `INSERT INTO Contacts(id, name) VALUES($1, $2)
       ON CONFLICT (id) DO UPDATE SET name = COALESCE(EXCLUDED.name, Contacts.name)`,
      [id, displayName]
    );
  } catch (err) {
    console.error(`Failed to upsert contact for chat ${id}`, err.message);
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function shouldFetch() {
  const res = await pool.query('SELECT last_fetch FROM FetchMeta LIMIT 1');
  if (res.rowCount === 0) return true;
  const last = res.rows[0].last_fetch;
  return Date.now() - new Date(last).getTime() > 7 * 24 * 60 * 60 * 1000;
}

async function updateLastFetch() {
  const now = new Date();
  const res = await pool.query('SELECT last_fetch FROM FetchMeta');
  if (res.rowCount === 0) {
    await pool.query('INSERT INTO FetchMeta(last_fetch) VALUES ($1)', [now]);
  } else {
    await pool.query('UPDATE FetchMeta SET last_fetch=$1', [now]);
  }
}

async function fetchHistory(client, limit = 200) {
  const chats = await client.getChats();
  console.log(`Found ${chats.length} chats. Starting fetch...`);
  for (const chat of chats) {
    if (shouldSkipChat(chat)) continue;
    const id = normalizeChatId(chat);
    await upsertContact(chat);
    console.log(`Fetching history for: ${chat.name || id}`);
    const messages = await chat.fetchMessages({ limit });
    for (const msg of messages) {
      await logMessageDetails(msg, { transcribe: false });
    }
    console.log(`-> Processed ${messages.length} messages for ${chat.name || id}`);
    await sleep(30000);
  }
}

async function maybeFetchHistory(client) {
  if (!(await shouldFetch())) {
    console.log('History fetch skipped (recently run)');
    return;
  }
  console.log('Starting history fetch...');
  try {
    await fetchHistory(client);
    await updateLastFetch();
    console.log('History fetch completed.');
  } catch (err) {
    console.error('History fetch failed', err);
  }
}

module.exports = { maybeFetchHistory };
