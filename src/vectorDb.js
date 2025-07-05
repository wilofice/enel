const { ChromaClient } = require('chromadb');
const config = require('./config');
const embedder = require('./embeddingService');

const COLLECTION = 'messages';
const chromaUrl = new URL(config.chromaUrl || 'http://localhost:8000');
const chroma = new ChromaClient({
  host: chromaUrl.hostname,
  port: parseInt(chromaUrl.port || (chromaUrl.protocol === 'https:' ? '443' : '80'), 10),
  ssl: chromaUrl.protocol === 'https:'
});
let collection;

async function ensureCollection() {
  if (collection) return;
  const embeddingFunction = {
    name: 'hash-embedder',
    generate: async texts => embedder.embedMany(texts)
  };
  collection = await chroma.getOrCreateCollection({
    name: COLLECTION,
    embeddingFunction
  });
}

async function upsertVector(id, vector, metadata) {
  await ensureCollection();
  await collection.upsert({
    ids: [id],
    embeddings: [vector],
    metadatas: [metadata]
  });
}

async function queryVector(vector, k = 5, where) {
  await ensureCollection();
  const res = await collection.query({
    queryEmbeddings: [vector],
    nResults: k,
    where
  });
  const results = [];
  for (let i = 0; i < res.ids[0].length; i++) {
    results.push({
      id: res.ids[0][i],
      distance: res.distances[0][i],
      metadata: res.metadatas ? res.metadatas[0][i] : undefined
    });
  }
  return results;
}

module.exports = { upsertVector, queryVector, ensureCollection };
