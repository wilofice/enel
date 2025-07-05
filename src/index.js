const config = require('./config');
const db = require('./db');
const setupDb = require('./setupDb');
const initWhatsApp = require('./waClient');
const { maybeFetchHistory } = require('./fetchHistory');
const startDashboard = require('./dashboard');
const audioJob = require('./audioJob');
const vectorJob = require('./vectorJob');

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
  const client = await initWhatsApp();
  await maybeFetchHistory(client);
  await vectorJob.run();
  audioJob.startProcessing();
  startDashboard(client);
  console.log('WhatsApp AI Auto-Responder initialized');
}

start().catch(err => {
  console.error('Startup failed', err);
});
