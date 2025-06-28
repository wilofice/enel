const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const defaults = {
  asrEngine: 'local',
  llmEngine: 'local',
  historyLimit: 10,
  baseFolder: 'data'
};

let fileConfig = {};
try {
  const configPath = path.join(__dirname, '..', 'config.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  fileConfig = JSON.parse(raw);
} catch (err) {
  console.warn('config.json not found or invalid, using defaults');
}

module.exports = {
  ...defaults,
  ...fileConfig,
  databaseUrl: process.env.DATABASE_URL
};
