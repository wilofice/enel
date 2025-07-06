const { pool } = require('./db');

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

async function storeFollowUp(contactId, reason, messageId) {
  await pool.query(
    `INSERT INTO FollowUps(contactId, reason, messageId)
     VALUES ($1, $2, $3)`,
    [contactId, reason, messageId]
  );
}

async function getUnansweredQuestions(days = 2) {
  const cutoff = Math.floor(Date.now() / 1000) - days * 86400;
  const { rows } = await pool.query(
    `SELECT m.id, m.chatId, m.body
       FROM Messages m
      WHERE m.fromMe = false
        AND m.body LIKE '%?%'
        AND m.timestamp >= $1
        AND NOT EXISTS (
          SELECT 1 FROM Messages m2
           WHERE m2.chatId = m.chatId
             AND m2.fromMe = true
             AND m2.timestamp > m.timestamp
        )`,
    [cutoff]
  );
  return rows;
}

async function getStaleContacts(days = 30) {
  const cutoff = Math.floor(Date.now() / 1000) - days * 86400;
  const { rows } = await pool.query(
    `SELECT chatId, MAX(timestamp) AS last_time
       FROM Messages
       GROUP BY chatId
       HAVING MAX(timestamp) < $1`,
    [cutoff]
  );
  return rows.map(r => ({ chatId: r.chatid, last: r.last_time }));
}

async function processFollowUps() {
  const questions = await getUnansweredQuestions();
  for (const q of questions) {
    await storeFollowUp(q.chatid, 'question', q.id);
  }
  const stale = await getStaleContacts();
  for (const s of stale) {
    await storeFollowUp(s.chatid, 'catch_up', null);
  }
}

async function run() {
  const jobName = 'followUp';
  await markJobStart(jobName);
  let error = null;
  try {
    await processFollowUps();
  } catch (err) {
    console.error('Follow-up job error', err.message);
    error = err;
  }
  await markJobEnd(jobName, error);
  if (error) throw error;
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { run };
