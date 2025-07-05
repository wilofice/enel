const config = require('./config');

const COLLECTION = 'messages';
const baseUrl = config.chromaUrl || 'http://localhost:8000';
let ensured = false;

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new Error(`Chroma request failed: ${res.status}`);
  }
  return res.json();
}

async function ensureCollection() {
  if (ensured) return;
  try {
    await fetchJson(`${baseUrl}/api/v1/collections/${COLLECTION}`);
  } catch {
    await fetchJson(`${baseUrl}/api/v1/collections`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: COLLECTION })
    });
  }
  ensured = true;
}

async function upsertVector(id, vector, metadata) {
  await ensureCollection();
  const body = {
    ids: [id],
    embeddings: [vector],
    metadatas: [metadata]
  };
  await fetchJson(`${baseUrl}/api/v1/collections/${COLLECTION}/upsert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function queryVector(vector, k = 5, where) {
  await ensureCollection();
  const body = {
    query_embeddings: [vector],
    n_results: k
  };
  if (where) body.where = where;
  const res = await fetchJson(`${baseUrl}/api/v1/collections/${COLLECTION}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const results = [];
  for (let i = 0; i < res.ids[0].length; i++) {
    results.push({
      id: res.ids[0][i],
      distance: res.distances[0][i],
      metadata: res.metadatas[0][i]
    });
  }
  return results;
}

module.exports = { upsertVector, queryVector, ensureCollection };
