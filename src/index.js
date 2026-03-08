const fs = require('fs');
const path = require('path');
const config = require('./config');
const db = require('./db');
const setupDb = require('./setupDb');
const initWhatsApp = require('./waClient');
const { maybeFetchHistory } = require('./fetchHistory');
const startDashboard = require('./dashboard');
const audioJob = require('./audioJob');
const vectorJob = require('./vectorJob');
const { acquireLock } = require('./lock');
const { refreshContacts, shouldRefresh } = require('./updateContacts');

const AUTH_DIR = path.join(__dirname, '..', '.wwebjs_auth');

async function clearWhatsAppSession() {
  try {
    await fs.promises.rm(AUTH_DIR, { recursive: true, force: true });
    console.log('Removed previous WhatsApp auth session cache');
  } catch (err) {
    console.warn('Failed to remove previous auth cache', err.message);
  }
}

async function start() {
  acquireLock();
  console.log('Configuration loaded:', {
    asrEngine: config.asrEngine,
    llmEngine: config.llmEngine,
    historyLimit: config.historyLimit,
    baseFolder: config.baseFolder,
    databaseUrl: config.databaseUrl ? 'present' : 'missing'
  });
  await db.waitForDb();
  await setupDb();
  await clearWhatsAppSession();
  const client = await initWhatsApp();
  if (!config.skipFetchHistory) {
    await maybeFetchHistory(client);
  }
  if (!config.skipVectorJob) {
    await vectorJob.run();
  }
  if (await shouldRefresh()) {
    await refreshContacts(client);
  }
  //audioJob.startProcessing();
  startDashboard(client);
  console.log('WhatsApp AI Auto-Responder initialized');
}

start().catch(err => {
  console.error('Startup failed', err);
});
