// use global fetch in Node 18+
const config = require('./config');

function buildPrompt(persona, history, newText) {
  let prompt = persona.trim() + '\n\n';
  for (const msg of history) {
    const role = msg.fromMe ? 'You' : 'Contact';
    prompt += `${role}: ${msg.text}\n`;
  }
  prompt += `Contact: ${newText}\nYou:`;
  return prompt;
}

async function callLocalLLM(prompt) {
  const body = { model: config.llmModel || 'llama3', prompt };
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
    const reader = res.body.getReader();
    let result = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      result += Buffer.from(value).toString();
    }
    return result.trim();
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

async function draftReply(persona, history, newText) {
  const prompt = buildPrompt(persona, history, newText);
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
    const reply = await draftReply(config.persona || 'You are a helpful assistant.', sampleHistory, 'Can you tell me a joke?');
    console.log('Draft reply:', reply);
  })();
}

module.exports = { draftReply, buildPrompt };
