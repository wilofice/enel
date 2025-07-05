const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
// use global fetch available in Node 18+
const config = require('./config');

/**
 * Transcribes audio using local Whisper command line.
 * Returns { text, confidence } or null on failure.
 */
async function transcribeLocal(filePath, language = 'auto', onProcess) {
  return new Promise((resolve) => {
    const outDir = path.dirname(filePath);
    const args = [
      filePath,
      '--model',
      config.whisperModel || 'base',
      '--output_format',
      'json',
      '--output_dir',
      outDir
    ];
    if (language && language !== 'auto') args.push('--language', language);
    let detected = null;
    let prob = null;
    const child = execFile('whisper', args, (error, stdout, stderr) => {
      if (error) {
        console.error('Local ASR failed', error.message);
        return resolve(null);
      }
      const langMatch = (stderr || '').match(/Detected language:\s+([\w-]+)\s+with probability\s+([0-9.]+)/i);
      if (langMatch) {
        detected = langMatch[1];
        prob = parseFloat(langMatch[2]);
      }
      const outFile = path.join(outDir, path.basename(filePath, path.extname(filePath)) + '.json');
      fs.readFile(outFile, 'utf8', (err, data) => {
        if (err) {
          console.error('Failed to read whisper output', err.message);
          return resolve(null);
        }
        try {
          const json = JSON.parse(data);
          resolve({
            text: json.text.trim(),
            confidence: 1,
            language: detected || json.language,
            languageConfidence: prob
          });
        } catch (e) {
          console.error('Failed to parse whisper JSON', e.message);
          resolve(null);
        }
      });
    });
    if (typeof onProcess === 'function') onProcess(child);
  });
}

/**
 * Example cloud transcription using OpenAI Whisper API.
 * Requires OPENAI_API_KEY in environment variables.
 */
async function transcribeCloud(filePath, language = 'auto') {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY not set for cloud ASR');
    return null;
  }

  const url = 'https://api.openai.com/v1/audio/transcriptions';
  const formData = new FormData();
  formData.append('model', 'whisper-1');
  formData.append('file', fs.createReadStream(filePath));
  if (language && language !== 'auto') formData.append('language', language);

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
    return { text: json.text, confidence: 1, language: null, languageConfidence: null };
  } catch (err) {
    console.error('Cloud ASR error', err.message);
    return null;
  }
}

async function transcribe(filePath, language = 'auto', onProcess) {
  if (config.asrEngine === 'cloud') {
    return transcribeCloud(filePath, language);
  }
  return transcribeLocal(filePath, language, onProcess);
}

module.exports = { transcribe };
