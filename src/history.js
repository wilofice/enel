const { pool } = require('./db');
const config = require('./config');

async function getHistory(chatId, limit = config.historyLimit) {
  if (!chatId) throw new Error('chatId required');
  const res = await pool.query(
    `SELECT m.id, m.fromMe, m.timestamp,
            COALESCE(t.transcriptText, m.body) AS text
     FROM Messages m
     LEFT JOIN Transcripts t ON m.id = t.messageId
     WHERE m.chatId = $1
     ORDER BY m.timestamp DESC
     LIMIT $2`,
    [chatId, limit]
  );
  return res.rows;
}

module.exports = { getHistory };
