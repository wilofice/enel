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
