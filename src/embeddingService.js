const crypto = require('crypto');

function embed(text) {
  if (!text) return [];
  const dim = 128;
  const vec = new Array(dim).fill(0);
  const tokens = text.toLowerCase().split(/\s+/);
  for (const tok of tokens) {
    const hash = crypto.createHash('md5').update(tok).digest();
    const idx = hash[0] % dim;
    vec[idx] += 1;
  }
  return vec;
}

function embedMany(texts) {
  return texts.map(embed);
}

module.exports = { embed, embedMany };
