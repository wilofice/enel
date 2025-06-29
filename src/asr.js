const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
// use global fetch available in Node 18+
const config = require('./config');

/**
 * Transcribes audio using local Whisper command line.
 * Returns { text, confidence } or null on failure.
 */
async function transcribeLocal(filePath) {
  return new Promise((resolve) => {
    const outDir = path.dirname(filePath);
    const args = [filePath, '--model', 'base', '--output_format', 'txt', '--output_dir', outDir];
    execFile('whisper', args, (error) => {
      if (error) {
        console.error('Local ASR failed', error.message);
        return resolve(null);
      }
      const outFile = path.join(outDir, path.basename(filePath, path.extname(filePath)) + '.txt');
      fs.readFile(outFile, 'utf8', (err, data) => {
        if (err) {
          console.error('Failed to read whisper output', err.message);
          return resolve(null);
        }
        resolve({ text: data.trim(), confidence: 1 });
      });
    });
  });
}

/**
 * Example cloud transcription using OpenAI Whisper API.
 * Requires OPENAI_API_KEY in environment variables.
 */
async function transcribeCloud(filePath) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY not set for cloud ASR');
    return null;
  }

  const url = 'https://api.openai.com/v1/audio/transcriptions';
  const formData = new FormData();
  formData.append('model', 'whisper-1');
  formData.append('file', fs.createReadStream(filePath));

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData
    });
    if (!res.ok) {
      console.error('Cloud ASR request failed', await res.text());
      return null;
    }
    const json = await res.json();
    return { text: json.text, confidence: 1 };
  } catch (err) {
    console.error('Cloud ASR error', err.message);
    return null;
  }
}

async function transcribe(filePath) {
  if (config.asrEngine === 'cloud') {
    return transcribeCloud(filePath);
  }
  return transcribeLocal(filePath);
}

module.exports = { transcribe };
