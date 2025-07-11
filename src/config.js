const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const defaults = {
  asrEngine: 'local',
  llmEngine: 'local',
  llmModel: 'llama3',
  historyLimit: 10,
  baseFolder: 'data',
  transcriptThreshold: 0,
  asrLanguage: 'auto',
  persona: 'You are a helpful WhatsApp assistant.',
  approvalRequired: true,
  generateReplies: true,
  plugins: [],
  ignoreShortMessages: true,
  assistantLookbackDays: 2,
  profileLlmEngine: 'local',
  profileLlmModel: 'llama3',
  whisperModel: 'base',
  chromaUrl: 'http://localhost:8000',
  dashboardUser: process.env.DASHBOARD_USER || null,
  dashboardPass: process.env.DASHBOARD_PASS || null
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
  databaseUrl: process.env.DATABASE_URL,
  dashboardUser: process.env.DASHBOARD_USER || fileConfig.dashboardUser || defaults.dashboardUser,
  dashboardPass: process.env.DASHBOARD_PASS || fileConfig.dashboardPass || defaults.dashboardPass
};
