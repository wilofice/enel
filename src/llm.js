// use global fetch in Node 18+
const config = require('./config');

function formatTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

function buildPrompt(persona, history, newText, newTimestamp) {
  let prompt = persona.trim() + '\n\n';
  for (const msg of history) {
    const role = msg.fromMe ? 'You' : 'Contact';
    const time = formatTimestamp(msg.timestamp);
    prompt += `[${time}] ${role}: ${msg.text}\n`;
  }
  const newTime = formatTimestamp(newTimestamp);
  prompt += `[${newTime}] Contact: ${newText}\nYou:`;
  return prompt;
}

async function callLocalLLM(prompt) {
  const body = { model: config.llmModel || 'llama3', prompt, stream: false };
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      console.error('Local LLM request failed', await res.text());
      return null;
    }
    const json = await res.json();
    return json.response ? json.response.trim() : null;
  } catch (err) {
    console.error('Local LLM error', err.message);
    return null;
  }
}

async function callProLLM(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not set for pro LLM');
    return null;
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;
  const body = { contents: [{ role: 'user', parts: [{ text: prompt }] }] };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      console.error('Pro LLM request failed', await res.text());
      return null;
    }
    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? text.trim() : null;
  } catch (err) {
    console.error('Pro LLM error', err.message);
    return null;
  }
}

async function draftReply(persona, history, newText, newTimestamp) {
  const prompt = buildPrompt(persona, history, newText, newTimestamp);
  console.log('\nPrompt sent to LLM:\n');
  console.log(prompt);
  if (config.llmEngine === 'pro') {
    return callProLLM(prompt);
  }
  return callLocalLLM(prompt);
}

if (require.main === module) {
  (async () => {
    const sampleHistory = [
      { fromMe: false, text: 'Hello there!' },
      { fromMe: true, text: 'Hi, how can I help you?' }
    ];
    const reply = await draftReply(
      config.persona || 'You are a helpful assistant.',
      sampleHistory,
      'Can you tell me a joke?',
      Math.floor(Date.now() / 1000)
    );
    console.log('Draft reply:', reply);
  })();
}

module.exports = { draftReply, buildPrompt };
