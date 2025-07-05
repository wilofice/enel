const embedder = require('./embeddingService');
const vectorDb = require('./vectorDb');

async function searchSimilar(text, k = 5, where) {
  const vector = embedder.embed(text);
  try {
    return await vectorDb.queryVector(vector, k, where);
  } catch (err) {
    console.error('Vector search failed', err.message);
    return [];
  }
}

module.exports = { searchSimilar };
