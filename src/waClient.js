const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const mime = require('mime');
const { pool } = require('./db');
const config = require('./config');
const asr = require('./asr');
const { getHistory } = require('./history');
const { draftReply } = require('./llm');
const confirmDraft = require('./confirm');
const { sendMessage } = require('./send');

async function storeMessage(msg) {
  if (!msg || !msg.id) return;
  const id = msg.id._serialized || msg.id;
  const chatId = msg.from;
  const timestamp = msg.timestamp;
  const body = msg.body;

  try {
    await pool.query(
      'INSERT INTO Contacts(id) VALUES($1) ON CONFLICT (id) DO NOTHING',
      [chatId]
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
      return;
    }

    const contact = msg.from;
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

const messageQueue = [];
let processingQueue = false;

function enqueueMessage(client, msg) {
  messageQueue.push({ client, msg });
  processQueue();
}

async function processQueue() {
  if (processingQueue) return;
  processingQueue = true;
  while (messageQueue.length > 0) {
    const { client, msg } = messageQueue.shift();
    try {
      await handleIncoming(client, msg);
    } catch (err) {
      console.error('Failed to process incoming message', err.message);
    }
  }
  processingQueue = false;
}

async function handleIncoming(client, msg) {
  await storeMessage(msg);
  const filePath = await storeMedia(msg);
  await transcribeAndStore(msg, filePath);

  const historyRecords = await getHistory(msg.from, config.historyLimit + 1);
  if (historyRecords.length === 0) return;

  const [latest, ...rest] = historyRecords;
  const history = rest.reverse();
  const newText = latest.text || '';

  const draft = await draftReply(config.persona, history, newText);
  if (!draft) return;

  const finalText = await confirmDraft(draft);
  if (finalText) {
    await sendMessage(client, msg.from, finalText, msg.id._serialized || msg.id);
  }
}

function initWhatsApp() {
  return new Promise((resolve, reject) => {
    const client = new Client({
      authStrategy: new LocalAuth()
    });

    client.on('qr', (qr) => {
      qrcode.generate(qr, { small: true });
      console.log('Scan the QR code above to authenticate');
    });

    client.on('ready', () => {
      console.log('WhatsApp client ready');
      resolve(client);
    });

    client.on('auth_failure', (msg) => {
      console.error('Authentication failure', msg);
      reject(new Error('Authentication failed'));
    });

    client.on('error', (err) => {
      console.error('WhatsApp client error', err);
    });

    client.on('message', (msg) => {
      if (!msg.fromMe) {
        enqueueMessage(client, msg);
      }
    });

    client.initialize();
  });
}

module.exports = initWhatsApp;
