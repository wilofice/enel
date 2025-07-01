const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const config = require('./config');
const { getHistory } = require('./history');
const { draftReply } = require('./llm');
const confirmDraft = require('./confirm');
const { sendMessage, logAiReply } = require('./send');
const { logMessageDetails } = require('./messageLogger');
const { getContactName } = require('./contacts');
const PluginManager = require('./pluginManager');

// logMessageDetails is provided by messageLogger.js

const messageQueue = [];
let processingQueue = false;
let generateDraftMessages = config.generateReplies;
let pluginManager = null;
function enqueueMessage(client, msg) {
  messageQueue.push({ client, msg });
  if (pluginManager) pluginManager.emit('incoming', msg);
  processQueue();
}

function isRealContactMessage(msg) {
  if (!msg || !msg.from) return false;
  if (msg.isStatus) return false;
  if (msg.from.endsWith('@broadcast')) return false;
  if (/@\w*newsletter\b/.test(msg.from)) return false;
  if (config.ignoreShortMessages && msg.body && msg.body.trim().length < 2) return false;
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

  if(!generateDraftMessages) return;

  const historyRecords = await getHistory(msg.from, config.historyLimit);
  if (historyRecords.length === 0) return;

  const latest = historyRecords[historyRecords.length - 1];
  const history = historyRecords.slice(0, -1);
  const newText = latest.text || '';

  const contactName = (await getContactName(msg.from)) || msg.notifyName || 'Contact';

  const draft = await draftReply(
    config.persona,
    history,
    newText,
    latest.timestamp,
    contactName
  );
  if (!draft) return;
  const originalId = msg.id._serialized || msg.id;
  await logAiReply(originalId, draft, 'draft', null);
  console.log('Incoming message body: ', msg.body);
  console.log('History of messages is : ', history.map(record => record.text));
  const finalText = await confirmDraft(draft);
  if (finalText) {
    const sent = await sendMessage(client, msg.from, finalText, msg.id._serialized || msg.id);
    if (pluginManager) pluginManager.emit('afterSend', sent);
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
      pluginManager = new PluginManager({ client, db: null, config });
      pluginManager.loadPlugins();
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
        if (pluginManager) pluginManager.emit('outgoing', msg);
      } else {
        enqueueMessage(client, msg);
      }
    });

    client.initialize();
  });
}

module.exports = initWhatsApp;
