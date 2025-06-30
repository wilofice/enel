const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const config = require('./config');
const { getHistory } = require('./history');
const { draftReply } = require('./llm');
const confirmDraft = require('./confirm');
const { sendMessage } = require('./send');
const { logMessageDetails } = require('./messageLogger');

// logMessageDetails is provided by messageLogger.js

const messageQueue = [];
let processingQueue = false;

function enqueueMessage(client, msg) {
  messageQueue.push({ client, msg });
  processQueue();
}

function isRealContactMessage(msg) {
  if (!msg || !msg.from) return false;
  if (msg.isStatus) return false;
  if (msg.from.endsWith('@broadcast')) return false;
  if (/@\w*newsletter\b/.test(msg.from)) return false;
  return true;
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
  await logMessageDetails(msg);

  const historyRecords = await getHistory(msg.from, config.historyLimit);
  if (historyRecords.length === 0) return;

  const latest = historyRecords[historyRecords.length - 1];
  const history = historyRecords.slice(0, -1);
  const newText = latest.text || '';

  const draft = await draftReply(
    config.persona,
    history,
    newText,
    latest.timestamp
  );
  if (!draft) return;
  console.log('Incoming message body: ', msg.body);
  console.log('History of messages is : ', history.map(record => record.text));
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

    client.on('message_create', async (msg) => {
      if (!isRealContactMessage(msg)) return;
      if (msg.fromMe) {
        await logMessageDetails(msg);
      } else {
        enqueueMessage(client, msg);
      }
    });

    client.initialize();
  });
}

module.exports = initWhatsApp;
