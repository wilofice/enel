const { pool } = require('./db');
const { getHistory } = require('./history');
const { draftReply } = require('./llm');
const { getContactName } = require('./contacts');
const config = require('./config');

async function markJobStart(name) {
  await pool.query(
    `INSERT INTO JobStatus(job, lastStart) VALUES($1, NOW())
     ON CONFLICT (job) DO UPDATE SET lastStart = EXCLUDED.lastStart`,
    [name]
  );
}

async function markJobEnd(name, err) {
  await pool.query(
    `UPDATE JobStatus SET lastEnd = NOW(), lastError = $2 WHERE job = $1`,
    [name, err ? err.toString() : null]
  );
}

async function getPendingMessages(limit = 20) {
  const { rows } = await pool.query(
    `SELECT m.id, m.chatId, m.timestamp,
            COALESCE(t.transcriptText, m.body) AS text
       FROM Messages m
       LEFT JOIN Transcripts t ON m.id = t.messageId
       WHERE m.fromMe = false
         AND m.timestamp >= NOW() - ($2 || ' days')::INTERVAL
         AND NOT EXISTS (
           SELECT 1 FROM Outbox o WHERE o.sourceMessageId = m.id
         )
       ORDER BY m.timestamp DESC
       LIMIT $1`,
    [limit, config.assistantLookbackDays]
  );
  return rows;
}

async function processMessage(msg) {
  if (config.ignoreShortMessages && msg.text && msg.text.trim().length < 2) {
    return;
  }
  const historyRecords = await getHistory(msg.chatid, config.historyLimit);
  const history = historyRecords.filter(r => r.id !== msg.id);
  const contactName = (await getContactName(msg.chatid)) || 'Contact';
  const draft = await draftReply(
    config.persona,
    history,
    msg.text,
    msg.timestamp,
    contactName
  );
  if (!draft) return;
  await pool.query(
    `INSERT INTO Outbox(chatId, sourceMessageId, text, origin, status, priority)
     VALUES ($1, $2, $3, 'ai', 'draft', 1)`,
    [msg.chatid, msg.id, draft]
  );
}

async function run(limit = 20) {
  const jobName = 'assistant';
  await markJobStart(jobName);
  let error = null;
  try {
    if (!config.generateReplies) {
      await markJobEnd(jobName, null);
      return;
    }
    const pending = await getPendingMessages(limit);
    for (const msg of pending) {
      await processMessage(msg);
    }
  } catch (err) {
    console.error('Assistant job error', err.message);
    error = err;
  }
  await markJobEnd(jobName, error);
  if (error) throw error;
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { run };
