const config = require('./config');
const vectorSearch = require('./vectorSearch');

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
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY not set for pro profile LLM');
    return null;
  }
  const url = 'https://api.openai.com/v1/chat/completions';
  const body = {
    model: config.profileLlmModel || 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }]
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      console.error('Pro profile LLM request failed', await res.text());
      return null;
    }
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content;
    return text ? text.trim() : null;
  } catch (err) {
    console.error('Pro profile LLM error', err.message);
    return null;
  }
}

async function callGoogleLLM(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not set for Google profile LLM');
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
      console.error('Google profile LLM request failed', await res.text());
      return null;
    }
    const json = await res.json();
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
    return text ? text.trim() : null;
  } catch (err) {
    console.error('Google profile LLM error', err.message);
    return null;
  }
}

async function generateProfile(historyText, contactName, chatId) {
  let extended = historyText;
  if (chatId) {
    const similar = await vectorSearch.searchSimilar(historyText, 20, { chatId });
    const extraText = similar
      .map(r => (r.metadata.fromMe ? `Me: ${r.metadata.text}` : `${contactName}: ${r.metadata.text}`))
      .join('\n');
    if (extraText) extended += `\n${extraText}`;
  }
  const prompt = buildProfilePrompt(extended, contactName);
  if (config.profileLlmEngine === 'google') {
    return callGoogleLLM(prompt);
  }
  if (config.profileLlmEngine === 'pro') {
    return callProLLM(prompt);
  }
  return callLocalLLM(prompt);
}

module.exports = { generateProfile, buildProfilePrompt };

