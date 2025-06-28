const { Pool } = require('pg');
const config = require('./config');

const pool = new Pool({
  connectionString: config.databaseUrl
});

pool.on('error', (err) => {
  console.error('Unexpected database error', err);
});

async function testConnection() {
  try {
    await pool.query('SELECT 1');
    console.log('Connected to PostgreSQL');
  } catch (err) {
    console.error('PostgreSQL connection error:', err.message);
    throw err;
  }
}

module.exports = {
  pool,
  testConnection
};
