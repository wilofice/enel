const db = require('./db');
const setupDb = require('./setupDb');
const initWhatsApp = require('./waClient');
const assistantJob = require('./assistantJob');
const sendQueueJob = require('./sendQueueJob');

async function run() {
  await db.testConnection();
  await setupDb();
  //const client = await initWhatsApp();
  await assistantJob.run();
  //await sendQueueJob.run(client);
}

if (require.main === module) {
  run().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { run };
