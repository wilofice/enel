const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({
  connectionString: config.databaseUrl
});

pool.on('error', (err) => {
  console.error('Unexpected database error', err);
});

async function testConnection() {
  await pool.query('SELECT 1');
}

async function waitForDb(retries = 5, delayMs = 2000) {
  for (let i = 0; i < retries; i++) {
    try {
      await testConnection();
      console.log('Connected to PostgreSQL');
      return;
    } catch (err) {
      console.error('PostgreSQL connection error:', err.message);
      if (i === retries - 1) throw err;
      console.log('Retrying database connection in', delayMs, 'ms');
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
}

module.exports = {
  pool,
  testConnection,
  waitForDb
};
