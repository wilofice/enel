const fs = require('fs');
const path = require('path');
const mime = require('mime');
const { pool } = require('./db');
const config = require('./config');
const asr = require('./asr');

async function storeMessage(msg) {
  if (!msg || !msg.id) return;
  const id = msg.id._serialized || msg.id;
  const chatId = msg.fromMe ? msg.to : msg.from;
  const timestamp = msg.timestamp;
  const body = msg.body;

  try {
    const name =
      msg.notifyName ||
      msg.pushName ||
      (msg._data ? msg._data.notifyName || msg._data.pushName : null);
    await pool.query(
      'INSERT INTO Contacts(id, name) VALUES($1, $2) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name',
      [chatId, name]
    );
    await pool.query(
      `INSERT INTO Messages(id, chatId, fromMe, timestamp, body)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [id, chatId, msg.fromMe, timestamp, body]
    );
  } catch (err) {
    console.error('Failed to store message', err.message);
  }
}

async function storeMedia(msg) {
  if (!msg.hasMedia) return null;
  const id = msg.id._serialized || msg.id;

  try {
    const media = await msg.downloadMedia();
    if (!media) {
      console.warn('No media content for message', id);
      return null;
    }

    const contact = msg.fromMe ? msg.to : msg.from;
    const date = new Date(msg.timestamp * 1000).toISOString().slice(0, 10);
    const dir = path.join(config.baseFolder, contact, date);
    await fs.promises.mkdir(dir, { recursive: true });

    const extFromMime = media.mimetype ? mime.getExtension(media.mimetype) : '';
    const extFromName = media.filename ? path.extname(media.filename).slice(1) : '';
    const ext = extFromMime || extFromName;
    const filename = `${msg.timestamp}_${id}${ext ? '.' + ext : ''}`;
    const filePath = path.resolve(dir, filename);

    await fs.promises.writeFile(filePath, media.data, 'base64');

    await pool.query(
      'INSERT INTO Attachments(messageId, filePath) VALUES ($1, $2)',
      [id, filePath]
    );
    console.log('Saved media to', filePath);
    return filePath;
  } catch (err) {
    console.error('Failed to store media', err.message);
    return null;
  }
}

async function transcribeAndStore(msg, filePath) {
  if (!filePath) return;
  const id = msg.id._serialized || msg.id;
  const result = await asr.transcribe(filePath);
  if (!result || !result.text) return;
  const conf = result.confidence ?? 1;
  if (conf < config.transcriptThreshold) return;
  try {
    await pool.query(
      'INSERT INTO Transcripts(messageId, transcriptText, asrEngine) VALUES ($1, $2, $3)',
      [id, result.text, config.asrEngine]
    );
    console.log('Stored transcript for', id);
  } catch (err) {
    console.error('Failed to store transcript', err.message);
  }
}

async function logMessageDetails(msg) {
  await storeMessage(msg);
  const filePath = await storeMedia(msg);
  await transcribeAndStore(msg, filePath);
}

module.exports = { logMessageDetails };
