const { pool } = require('./db');

async function setup() {
  const queries = [
    `CREATE TABLE IF NOT EXISTS Contacts (
      id TEXT PRIMARY KEY,
      name TEXT,
      profile TEXT
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
      filePath TEXT,
      mimeType TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS Transcripts (
      id SERIAL PRIMARY KEY,
      messageId TEXT REFERENCES Messages(id),
      transcriptText TEXT,
      asrEngine TEXT,
      language TEXT,
      languageConfidence REAL,
      translatedText TEXT,
      translationLanguage TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS AiReplies (
      id SERIAL PRIMARY KEY,
      originalMessageId TEXT REFERENCES Messages(id),
      draftText TEXT,
      status TEXT,
      sentMessageId TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS Outbox (
      id SERIAL PRIMARY KEY,
      chatId TEXT,
      sourceMessageId TEXT REFERENCES Messages(id),
      text TEXT,
      origin TEXT,
      status TEXT,
      priority INTEGER DEFAULT 1,
      attempts INTEGER DEFAULT 0,
      sentMessageId TEXT,
      createdAt TIMESTAMPTZ DEFAULT now()
    )`,
    `CREATE TABLE IF NOT EXISTS JobStatus (
      job TEXT PRIMARY KEY,
      lastStart TIMESTAMPTZ,
      lastEnd TIMESTAMPTZ,
      lastError TEXT,
      retries INTEGER DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS VectorMeta (
      messageId TEXT PRIMARY KEY
    )`,
    `CREATE TABLE IF NOT EXISTS FetchMeta (
      last_fetch TIMESTAMPTZ
    )`
  ];

  // ensure new columns when upgrading
  queries.push(
    'ALTER TABLE Attachments ADD COLUMN IF NOT EXISTS mimeType TEXT'
  );
  queries.push(
    'ALTER TABLE Contacts ADD COLUMN IF NOT EXISTS profile TEXT'
  );
  queries.push(
    'ALTER TABLE Transcripts ADD COLUMN IF NOT EXISTS language TEXT'
  );
  queries.push(
    'ALTER TABLE Transcripts ADD COLUMN IF NOT EXISTS languageConfidence REAL'
  );
  queries.push(
    'ALTER TABLE Transcripts ADD COLUMN IF NOT EXISTS translatedText TEXT'
  );
  queries.push(
    'ALTER TABLE Transcripts ADD COLUMN IF NOT EXISTS translationLanguage TEXT'
  );
  queries.push(
    'ALTER TABLE Outbox ADD COLUMN IF NOT EXISTS sentMessageId TEXT'
  );

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
