const { pool } = require('./db');
const { logMessageDetails } = require('./messageLogger');

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
    if (chat.isGroup) continue;
    console.log(`Fetching history for: ${chat.name || chat.id._serialized}`);
    const messages = await chat.fetchMessages({ limit });
    for (const msg of messages) {
      await logMessageDetails(msg, { transcribe: false });
    }
    console.log(`-> Processed ${messages.length} messages for ${chat.name || chat.id._serialized}`);
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
