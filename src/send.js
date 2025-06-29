const { pool } = require('./db');

async function logAiReply(originalMessageId, draftText, status, sentMessageId) {
  try {
    await pool.query(
      `INSERT INTO AiReplies(originalMessageId, draftText, status, sentMessageId)
       VALUES ($1, $2, $3, $4)`,
      [originalMessageId, draftText, status, sentMessageId]
    );
  } catch (err) {
    console.error('Failed to log AiReply', err.message);
  }
}

async function sendMessage(client, chatId, text, originalMessageId) {
  if (!client || !chatId || !text) {
    throw new Error('client, chatId and text are required');
  }
  try {
    const sent = await client.sendMessage(chatId, text);
    const sentId = sent.id?._serialized || sent.id;
    await logAiReply(originalMessageId, text, 'sent', sentId);
    console.log('Message sent with id', sentId);
    return sent;
  } catch (err) {
    await logAiReply(originalMessageId, text, 'failed', null);
    console.error('Failed to send message', err.message);
    return null;
  }
}

module.exports = { sendMessage };

