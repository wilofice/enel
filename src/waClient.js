const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { pool } = require('./db');

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

    client.on('message', async (msg) => {
      if (!msg.fromMe) {
        console.log(msg);
        await storeMessage(msg);
      }
    });

    client.initialize();
  });
}

module.exports = initWhatsApp;
