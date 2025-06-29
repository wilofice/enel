const { pool } = require('./db');

async function setup() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS Contacts (
      id TEXT PRIMARY KEY,
      name TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS Messages (
      id TEXT PRIMARY KEY,
      chatId TEXT REFERENCES Contacts(id),
      fromMe BOOLEAN,
      timestamp BIGINT,
      body TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS Attachments (
      id SERIAL PRIMARY KEY,
      messageId TEXT REFERENCES Messages(id),
      filePath TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS Transcripts (
      id SERIAL PRIMARY KEY,
      messageId TEXT REFERENCES Messages(id),
      transcriptText TEXT,
      asrEngine TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS AiReplies (
      id SERIAL PRIMARY KEY,
      originalMessageId TEXT REFERENCES Messages(id),
      draftText TEXT,
      status TEXT,
      sentMessageId TEXT
    )`
  ];

  for (const q of queries) {
    try {
      await pool.query(q);
    } catch (err) {
      console.error('Error executing query:', q, err.message);
      throw err;
    }
  }
  console.log('Database schema ensured');
}

if (require.main === module) {
  setup()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = setup;
