const { pool } = require('./db');
const config = require('./config');

async function getHistory(chatId, limit = config.historyLimit) {
  if (!chatId) throw new Error('chatId required');

  const baseQuery = `SELECT m.id, m.fromMe, m.timestamp,
                            COALESCE(t.transcriptText, m.body) AS text,
                            c.name
                     FROM Messages m
                     LEFT JOIN Transcripts t ON m.id = t.messageId
                     LEFT JOIN Contacts c ON m.chatId = c.id
                     WHERE m.chatId = $1 AND m.fromMe = $2
                     ORDER BY m.timestamp DESC
                     LIMIT $3`;

  const [mine, theirs] = await Promise.all([
    pool.query(baseQuery, [chatId, true, limit]),
    pool.query(baseQuery, [chatId, false, limit])
  ]);

  const combined = [...mine.rows, ...theirs.rows];
  combined.sort((a, b) => a.timestamp - b.timestamp);
  const filtered = [];
  for (const msg of combined) {
    const last = filtered[filtered.length - 1];
    if (!last || last.text !== msg.text || last.fromMe !== msg.fromMe) {
      filtered.push(msg);
    }
  }
  return filtered;
}

module.exports = { getHistory };
