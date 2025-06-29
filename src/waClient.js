const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

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

    client.initialize();
  });
}

module.exports = initWhatsApp;
