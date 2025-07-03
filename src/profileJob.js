const { pool } = require('./db');
const { generateProfile } = require('./profileLlm');

async function getMessages(contactId, limit = 50) {
  const { rows } = await pool.query(
    `SELECT COALESCE(t.transcriptText, m.body) AS text,
            m.fromMe AS from_me
       FROM Messages m
       LEFT JOIN Transcripts t ON m.id = t.messageId
       WHERE m.chatId = $1
       ORDER BY m.timestamp DESC
       LIMIT $2`,
    [contactId, limit]
  );
  return rows
    .filter(r => r.text)
    .map(r => ({ text: r.text, fromMe: r.from_me }));
}

async function processContact(contactId, limit) {
  const { rows } = await pool.query('SELECT name FROM Contacts WHERE id=$1', [contactId]);
  const contactName = rows[0]?.name || 'Contact';
  const messages = await getMessages(contactId, limit);
  if (messages.length === 0) return;
  const historyText = messages
    .map(m => (m.fromMe ? `Me: ${m.text}` : `${contactName}: ${m.text}`))
    .join('\n');
  const profile = await generateProfile(historyText, contactName);
  if (!profile) return;
  await pool.query('UPDATE Contacts SET profile=$2 WHERE id=$1', [contactId, profile]);
  console.log('Updated profile for', contactId);
}

async function run(limit = 50) {
  const { rows } = await pool.query('SELECT id FROM Contacts');
  for (const row of rows) {
    await processContact(row.id, limit);
  }
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(err => {
    console.error('Profile job failed', err.message);
    process.exit(1);
  });
}

module.exports = { run };

