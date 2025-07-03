const config = require('./config');

function buildProfilePrompt(historyText, contactName = 'the contact') {
  const intro =
    `Analyze the following WhatsApp conversation between me and ${contactName}. ` +
    `Provide a concise profile of ${contactName}, including job, hobbies, family status, ` +
    `and any other relevant details. Also describe our relationship based on the messages.`;
  return `${intro}\n\n${historyText}\n\nProfile:`;
}

async function callLocalLLM(prompt) {
  const body = { model: config.profileLlmModel || 'llama3', prompt, stream: false };
  try {
    const res = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      console.error('Local profile LLM request failed', await res.text());
      return null;
    }
    const json = await res.json();
    return json.response ? json.response.trim() : null;
  } catch (err) {
    console.error('Local profile LLM error', err.message);
    return null;
  }
}

async function callProLLM(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not set for pro profile LLM');
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
      console.error('Pro profile LLM request failed', await res.text());
      return null;
    }
    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? text.trim() : null;
  } catch (err) {
    console.error('Pro profile LLM error', err.message);
    return null;
  }
}

async function generateProfile(historyText, contactName) {
  const prompt = buildProfilePrompt(historyText, contactName);
  if (config.profileLlmEngine === 'pro') {
    return callProLLM(prompt);
  }
  return callLocalLLM(prompt);
}

module.exports = { generateProfile, buildProfilePrompt };

