const fs = require('fs');
const path = require('path');
const { pool } = require('./db');
const { sanitizeContactName } = require('./contactName');

function usage() {
  console.log('Usage: node src/importVcfContacts.js <path-to-vcf>');
}

function unfoldVcfLines(text) {
  const rawLines = text.split(/\r?\n/);
  const lines = [];
  for (const line of rawLines) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function decodeVcfValue(value) {
  if (!value) return '';
  return value
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

function normalizeDigits(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) return digits.slice(2);
  return digits;
}

function pickPreferredName(current, next) {
  if (!current) return next;
  if (!next) return current;
  if (next.length > current.length + 2) return next;
  if (next.includes(' ') && !current.includes(' ')) return next;
  return current;
}

function parseVcf(text) {
  const lines = unfoldVcfLines(text);
  const cards = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.toUpperCase() === 'BEGIN:VCARD') {
      current = { name: null, phones: [] };
      continue;
    }
    if (line.toUpperCase() === 'END:VCARD') {
      if (current) cards.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const keyPart = line.slice(0, colonIndex);
    const valuePart = decodeVcfValue(line.slice(colonIndex + 1));
    const key = keyPart.toUpperCase();

    if (key.startsWith('FN')) {
      current.name = current.name || valuePart;
    } else if (key.startsWith('N') && !current.name) {
      const parts = valuePart.split(';').map(p => p.trim()).filter(Boolean);
      current.name = parts.join(' ');
    } else if (key.startsWith('TEL')) {
      current.phones.push(valuePart);
    }
  }

  return cards;
}

async function findContactIdsByDigits(digits) {
  const exact = await pool.query(
    `SELECT id
       FROM Contacts
      WHERE REGEXP_REPLACE(COALESCE(contactNumber, SPLIT_PART(id, '@', 1)), '[^0-9]', '', 'g') = $1`,
    [digits]
  );
  if (exact.rowCount > 0) {
    return exact.rows.map(r => r.id);
  }

  if (digits.length < 8) return [];

  const fuzzy = await pool.query(
    `SELECT id
       FROM Contacts
      WHERE REGEXP_REPLACE(COALESCE(contactNumber, SPLIT_PART(id, '@', 1)), '[^0-9]', '', 'g') LIKE '%' || $1
         OR $1 LIKE '%' || REGEXP_REPLACE(COALESCE(contactNumber, SPLIT_PART(id, '@', 1)), '[^0-9]', '', 'g')`,
    [digits]
  );
  if (fuzzy.rowCount === 1) {
    return fuzzy.rows.map(r => r.id);
  }

  return [];
}

async function updateNameIfBetter(contactId, candidateName) {
  const { rowCount } = await pool.query(
    `UPDATE Contacts
        SET name = CASE
          WHEN $2 IS NULL THEN name
          WHEN name IS NULL OR BTRIM(name) = '' OR name = '@' THEN $2
          WHEN name ~* '@(c[.]us|s[.]whatsapp[.]net|g[.]us|broadcast|newsletter)$' THEN $2
          WHEN name ~ '^[+]?[0-9]{7,}$' AND $2 !~ '^[+]?[0-9]{7,}$' THEN $2
          WHEN POSITION(' ' IN $2) > 0
            AND POSITION(' ' IN COALESCE(name, '')) = 0
            AND CHAR_LENGTH($2) >= CHAR_LENGTH(COALESCE(name, '')) + 2 THEN $2
          WHEN CHAR_LENGTH($2) >= CHAR_LENGTH(COALESCE(name, '')) + 4 THEN $2
          ELSE name
        END
      WHERE id = $1
        AND (
          name IS DISTINCT FROM CASE
            WHEN $2 IS NULL THEN name
            WHEN name IS NULL OR BTRIM(name) = '' OR name = '@' THEN $2
            WHEN name ~* '@(c[.]us|s[.]whatsapp[.]net|g[.]us|broadcast|newsletter)$' THEN $2
            WHEN name ~ '^[+]?[0-9]{7,}$' AND $2 !~ '^[+]?[0-9]{7,}$' THEN $2
            WHEN POSITION(' ' IN $2) > 0
              AND POSITION(' ' IN COALESCE(name, '')) = 0
              AND CHAR_LENGTH($2) >= CHAR_LENGTH(COALESCE(name, '')) + 2 THEN $2
            WHEN CHAR_LENGTH($2) >= CHAR_LENGTH(COALESCE(name, '')) + 4 THEN $2
            ELSE name
          END
        )`,
    [contactId, candidateName]
  );
  return rowCount > 0;
}

async function run() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    usage();
    process.exit(1);
  }

  const resolvedPath = path.resolve(inputPath);
  if (!fs.existsSync(resolvedPath)) {
    console.error('VCF file not found:', resolvedPath);
    process.exit(1);
  }

  const vcfText = fs.readFileSync(resolvedPath, 'utf8');
  const cards = parseVcf(vcfText);

  const numberToName = new Map();
  let skippedInvalidName = 0;
  for (const card of cards) {
    const candidateName = sanitizeContactName(card.name);
    if (!candidateName) {
      skippedInvalidName++;
      continue;
    }

    for (const rawPhone of card.phones) {
      const digits = normalizeDigits(rawPhone);
      if (!digits) continue;
      const current = numberToName.get(digits);
      numberToName.set(digits, pickPreferredName(current, candidateName));
    }
  }

  let updates = 0;
  let misses = 0;
  let ambiguous = 0;

  for (const [digits, candidateName] of numberToName.entries()) {
    const ids = await findContactIdsByDigits(digits);
    if (ids.length === 0) {
      misses++;
      continue;
    }
    if (ids.length > 1) {
      ambiguous++;
      continue;
    }
    const changed = await updateNameIfBetter(ids[0], candidateName);
    if (changed) updates++;
  }

  console.log('VCF import complete.');
  console.log('Cards parsed:', cards.length);
  console.log('Unique numbers indexed:', numberToName.size);
  console.log('Names skipped (invalid/placeholder):', skippedInvalidName);
  console.log('Contacts updated:', updates);
  console.log('Numbers not matched:', misses);
  console.log('Ambiguous matches skipped:', ambiguous);
}

run()
  .then(async () => {
    await pool.end();
    process.exit(0);
  })
  .catch(async err => {
    console.error('Import failed:', err.message);
    await pool.end();
    process.exit(1);
  });
