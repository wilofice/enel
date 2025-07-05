const { pool } = require('./db');
const asr = require('./asr');
const config = require('./config');

let running = false;
let currentProcess = null;

async function getNext() {
  const { rows } = await pool.query(
    `SELECT a.messageId, a.filePath FROM Attachments a
     LEFT JOIN Transcripts t ON a.messageId = t.messageId
     WHERE t.messageId IS NULL AND a.mimeType LIKE 'audio/%'
     ORDER BY a.id ASC LIMIT 1`
  );
  return rows[0];
}

async function processOne() {
  const job = await getNext();
  if (!job) return false;
  console.log('Processing audio job', job.messageid, job.filepath);
  try {
    const result = await asr.transcribe(job.filepath, config.asrLanguage, p => {
      currentProcess = p;
    });
    currentProcess = null;
    if (result && result.text && (result.confidence ?? 1) >= config.transcriptThreshold) {
      await pool.query(
        'INSERT INTO Transcripts(messageId, transcriptText, asrEngine, language, languageConfidence) VALUES ($1, $2, $3, $4, $5)',
        [job.messageid, result.text, config.asrEngine, result.language, result.languageConfidence]
      );
    }
  } catch (err) {
    console.error('Audio job error', err.message);
  }
  return true;
}

async function run() {
  if (running) return;
  running = true;
  while (running) {
    const processed = await processOne();
    if (!processed) break;
  }
  running = false;
}

function startProcessing() {
  if (!running) run();
}

function pauseProcessing() {
  running = false;
  if (currentProcess && currentProcess.kill) {
    currentProcess.kill();
    currentProcess = null;
  }
}

function isProcessing() {
  return running;
}

if (require.main === module) {
  startProcessing();
}


module.exports = { startProcessing, pauseProcessing, isProcessing };
