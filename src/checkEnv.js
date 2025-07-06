const { execSync } = require('child_process');
const config = require('./config');

function checkWhisper() {
  try {
    execSync('which whisper', { stdio: 'ignore' });
    console.log('Whisper binary found');
    return true;
  } catch (err) {
    console.warn('Whisper binary not found in PATH');
    return false;
  }
}

function checkDatabaseUrl() {
  if (config.databaseUrl) {
    console.log('DATABASE_URL configured');
    return true;
  }
  console.warn('DATABASE_URL not set');
  return false;
}

function runChecks() {
  const whisperOk = checkWhisper();
  const dbOk = checkDatabaseUrl();
  if (!whisperOk || !dbOk) process.exitCode = 1;
}

if (require.main === module) {
  runChecks();
}

module.exports = { runChecks };
