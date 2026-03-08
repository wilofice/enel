const fs = require('fs');
const path = require('path');
const mime = require('mime');
const { pool } = require('./db');
const config = require('./config');
const asr = require('./asr');
const { sanitizeContactName, SQL_NAME_PREFERENCE } = require('./contactName');

function normalizeContactNumber(chatId) {
  if (!chatId) return null;
  const value = String(chatId);
  if (value.includes('@') && !value.endsWith('@c.us')) return null;
  const atIndex = value.indexOf('@');
  const base = atIndex === -1 ? value : value.slice(0, atIndex);
  const digits = base.replace(/\D/g, '');
  return digits.length >= 7 ? digits : null;
}

async function storeMessage(msg) {
  if (!msg || !msg.id) return;
  const id = msg.id._serialized || msg.id;
  const chatId = msg.fromMe ? msg.to : msg.from;
  const timestamp = msg.timestamp;
  const body = msg.body;
  const contactNumber = normalizeContactNumber(chatId);
  const lastSentAt = msg.fromMe ? timestamp : null;

  try {
    const rawName =
      msg.notifyName ||
      msg.pushName ||
      (msg._data ? msg._data.notifyName || msg._data.pushName : null);
    const name = sanitizeContactName(rawName, chatId);
    await pool.query(
      `INSERT INTO Contacts(id, name, contactNumber, lastSentAt, lastMessageAt)
       VALUES($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO UPDATE SET
         name = ${SQL_NAME_PREFERENCE},
         contactNumber = COALESCE(EXCLUDED.contactNumber, Contacts.contactNumber),
         lastSentAt = CASE
           WHEN EXCLUDED.lastSentAt IS NOT NULL THEN GREATEST(EXCLUDED.lastSentAt, Contacts.lastSentAt)
           ELSE Contacts.lastSentAt
         END,
         lastMessageAt = CASE
           WHEN EXCLUDED.lastMessageAt IS NOT NULL THEN GREATEST(EXCLUDED.lastMessageAt, Contacts.lastMessageAt)
           ELSE Contacts.lastMessageAt
         END`,
      [chatId, name, contactNumber, lastSentAt, timestamp]
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

    const mimeType = media.mimetype || '';
    const extFromMime = mimeType ? mime.getExtension(mimeType) : '';
    const extFromName = media.filename ? path.extname(media.filename).slice(1) : '';
    const ext = extFromMime || extFromName;
    const filename = `${msg.timestamp}_${id}${ext ? '.' + ext : ''}`;
    const filePath = path.resolve(dir, filename);

    await fs.promises.writeFile(filePath, media.data, 'base64');

    await pool.query(
      'INSERT INTO Attachments(messageId, filePath, mimeType) VALUES ($1, $2, $3)',
      [id, filePath, mimeType]
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
  const result = await asr.transcribe(filePath, config.asrLanguage);
  if (!result || !result.text) return;
  const conf = result.confidence ?? 1;
  if (conf < config.transcriptThreshold) return;
  try {
    await pool.query(
      'INSERT INTO Transcripts(messageId, transcriptText, asrEngine, language, languageConfidence) VALUES ($1, $2, $3, $4, $5)',
      [id, result.text, config.asrEngine, result.language, result.languageConfidence]
    );
    console.log('Stored transcript for', id);
  } catch (err) {
    console.error('Failed to store transcript', err.message);
  }
}

async function logMessageDetails(msg, opts = {}) {
  const {
    transcribe = true,
    storeMessage: shouldStoreMessage = true,
    storeMedia: shouldStoreMedia = true
  } = opts;

  let filePath = null;
  if (shouldStoreMessage) {
    await storeMessage(msg);
  }
  if (shouldStoreMedia && shouldStoreMessage) {
    filePath = await storeMedia(msg);
  } else if (shouldStoreMedia && !shouldStoreMessage) {
    console.warn('Cannot store media when storeMessage=false; skipping media download');
  }
  if (transcribe && filePath) {
    await transcribeAndStore(msg, filePath);
  }
}

module.exports = { logMessageDetails, storeMessage, storeMedia, transcribeAndStore };
