const { pool } = require('./db');
const { sendMessage } = require('./send');
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

async function getQueue(limit = 20) {
  const { rows } = await pool.query(
    `SELECT * FROM Outbox
       WHERE status = 'draft' OR status = 'queued'
       ORDER BY priority DESC, id ASC
       LIMIT $1`,
    [limit]
  );
  return rows;
}

async function processRow(row, client) {
  if (config.approvalRequired && row.status === 'draft') {
    return;
  }
  try {
    const sent = await sendMessage(client, row.chatid, row.text, row.sourcemessageid);
    const sentId = sent && (sent.id?._serialized || sent.id);
    await pool.query(
      'UPDATE Outbox SET status=$1, sentMessageId=$2 WHERE id=$3',
      ['sent', sentId, row.id]
    );
  } catch (err) {
    const attempts = row.attempts + 1;
    const status = attempts >= 3 ? 'failed' : 'queued';
    await pool.query(
      'UPDATE Outbox SET status=$1, attempts=$2 WHERE id=$3',
      [status, attempts, row.id]
    );
    throw err;
  }
}

async function run(client, limit = 20) {
  const jobName = 'sendQueue';
  await markJobStart(jobName);
  let error = null;
  try {
    const queue = await getQueue(limit);
    for (const row of queue) {
      await processRow(row, client);
    }
  } catch (err) {
    console.error('Send queue job error', err.message);
    error = err;
  }
  await markJobEnd(jobName, error);
  if (error) throw error;
}

module.exports = { run };
