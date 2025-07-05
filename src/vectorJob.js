const { pool } = require('./db');
const embedder = require('./embeddingService');
const vectorDb = require('./vectorDb');

async function getUnembedded(limit = 20) {
  const { rows } = await pool.query(
    `SELECT m.id, m.chatId, m.fromMe AS from_me, m.timestamp,
            COALESCE(t.transcriptText, m.body) AS text
       FROM Messages m
        LEFT JOIN Transcripts t ON m.id = t.messageId
        WHERE NOT EXISTS (
          SELECT 1 FROM VectorMeta v WHERE v.messageId = m.id
        ) AND COALESCE(t.transcriptText, m.body) <> ''
       ORDER BY m.timestamp ASC
       LIMIT $1`,
    [limit]
  );
  return rows;
}

async function processMessage(msg) {
  const vector = embedder.embed(msg.text);
  await vectorDb.upsertVector(msg.id, vector, {
    chatId: msg.chatId,
    fromMe: msg.from_me,
    text: msg.text,
    timestamp: msg.timestamp
  });
  await pool.query('INSERT INTO VectorMeta(messageId) VALUES($1)', [msg.id]);
}

async function run(limit = 100) {
  await vectorDb.ensureCollection();
  let batch;
  do {
    batch = await getUnembedded(limit);
    for (const msg of batch) {
      await processMessage(msg);
    }
  } while (batch.length === limit);
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(err => {
    console.error('Vector job failed', err.message);
    process.exit(1);
  });
}

module.exports = { run };
