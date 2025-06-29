const { pool } = require('./db');
const config = require('./config');

async function getHistory(chatId, limit = config.historyLimit) {
  if (!chatId) throw new Error('chatId required');

  const baseQuery = `SELECT m.id, m.fromMe, m.timestamp,
                            COALESCE(t.transcriptText, m.body) AS text
                     FROM Messages m
                     LEFT JOIN Transcripts t ON m.id = t.messageId
                     WHERE m.chatId = $1 AND m.fromMe = $2
                     ORDER BY m.timestamp DESC
                     LIMIT $3`;

  const [mine, theirs] = await Promise.all([
    pool.query(baseQuery, [chatId, true, limit]),
    pool.query(baseQuery, [chatId, false, limit])
  ]);

  const combined = [...mine.rows, ...theirs.rows];
  combined.sort((a, b) => a.timestamp - b.timestamp);
  return combined;
}

module.exports = { getHistory };
