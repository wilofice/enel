const config = require('./config');
const db = require('./db');
const setupDb = require('./setupDb');
const initWhatsApp = require('./waClient');

async function start() {
  console.log('Configuration loaded:', {
    asrEngine: config.asrEngine,
    llmEngine: config.llmEngine,
    historyLimit: config.historyLimit,
    baseFolder: config.baseFolder,
    databaseUrl: config.databaseUrl ? 'present' : 'missing'
  });
  await db.testConnection();
  await setupDb();
  await initWhatsApp();
  console.log('WhatsApp AI Auto-Responder initialized');
}

start().catch(err => {
  console.error('Startup failed', err);
});
