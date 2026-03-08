const fs = require('fs');
const path = require('path');
const { pool } = require('./db');
const { sanitizeContactName } = require('./contactName');

function usage() {
  console.log('Usage: node src/importVcfContacts.js <path-to-vcf> [--report [output.csv]]');
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
    return {
      ids: exact.rows.map(r => r.id),
      reason: exact.rowCount === 1 ? 'exact_match' : 'exact_ambiguous',
      exactCount: exact.rowCount,
      fuzzyCount: 0
    };
  }

  if (digits.length < 8) {
    return { ids: [], reason: 'too_short_for_fuzzy', exactCount: 0, fuzzyCount: 0 };
  }

  const fuzzy = await pool.query(
    `SELECT id
       FROM Contacts
      WHERE REGEXP_REPLACE(COALESCE(contactNumber, SPLIT_PART(id, '@', 1)), '[^0-9]', '', 'g') LIKE '%' || $1
         OR $1 LIKE '%' || REGEXP_REPLACE(COALESCE(contactNumber, SPLIT_PART(id, '@', 1)), '[^0-9]', '', 'g')`,
    [digits]
  );
  if (fuzzy.rowCount === 1) {
    return {
      ids: fuzzy.rows.map(r => r.id),
      reason: 'fuzzy_match',
      exactCount: 0,
      fuzzyCount: fuzzy.rowCount
    };
  }

  return {
    ids: [],
    reason: fuzzy.rowCount > 1 ? 'fuzzy_ambiguous' : 'no_match',
    exactCount: 0,
    fuzzyCount: fuzzy.rowCount
  };
}

async function updateNameIfBetter(contactId, candidateName) {
  const { rowCount } = await pool.query(
    `UPDATE Contacts
        SET name = CASE
          WHEN CAST($2 AS TEXT) IS NULL THEN name
          WHEN name IS NULL OR BTRIM(name) = '' OR name = '@' THEN CAST($2 AS TEXT)
          WHEN name ~* '@(c[.]us|s[.]whatsapp[.]net|g[.]us|broadcast|newsletter)$' THEN CAST($2 AS TEXT)
          WHEN REGEXP_REPLACE(COALESCE(name, ''), '[^0-9]', '', 'g') ~ '^[0-9]{7,}$'
            AND REGEXP_REPLACE(CAST($2 AS TEXT), '[^0-9]', '', 'g') !~ '^[0-9]{7,}$' THEN CAST($2 AS TEXT)
          WHEN POSITION(' ' IN CAST($2 AS TEXT)) > 0
            AND POSITION(' ' IN COALESCE(name, '')) = 0
            AND CHAR_LENGTH(CAST($2 AS TEXT)) >= CHAR_LENGTH(COALESCE(name, '')) + 2 THEN CAST($2 AS TEXT)
          WHEN CHAR_LENGTH(CAST($2 AS TEXT)) >= CHAR_LENGTH(COALESCE(name, '')) + 4 THEN CAST($2 AS TEXT)
          ELSE name
        END
      WHERE id = $1
        AND (
          name IS DISTINCT FROM CASE
            WHEN CAST($2 AS TEXT) IS NULL THEN name
            WHEN name IS NULL OR BTRIM(name) = '' OR name = '@' THEN CAST($2 AS TEXT)
            WHEN name ~* '@(c[.]us|s[.]whatsapp[.]net|g[.]us|broadcast|newsletter)$' THEN CAST($2 AS TEXT)
            WHEN REGEXP_REPLACE(COALESCE(name, ''), '[^0-9]', '', 'g') ~ '^[0-9]{7,}$'
              AND REGEXP_REPLACE(CAST($2 AS TEXT), '[^0-9]', '', 'g') !~ '^[0-9]{7,}$' THEN CAST($2 AS TEXT)
            WHEN POSITION(' ' IN CAST($2 AS TEXT)) > 0
              AND POSITION(' ' IN COALESCE(name, '')) = 0
              AND CHAR_LENGTH(CAST($2 AS TEXT)) >= CHAR_LENGTH(COALESCE(name, '')) + 2 THEN CAST($2 AS TEXT)
            WHEN CHAR_LENGTH(CAST($2 AS TEXT)) >= CHAR_LENGTH(COALESCE(name, '')) + 4 THEN CAST($2 AS TEXT)
            ELSE name
          END
        )`,
    [contactId, candidateName]
  );
  return rowCount > 0;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let inputPath = null;
  let reportEnabled = false;
  let reportPath = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--report') {
      reportEnabled = true;
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        reportPath = next;
        i++;
      }
      continue;
    }

    if (!inputPath) {
      inputPath = arg;
    }
  }

  return { inputPath, reportEnabled, reportPath };
}

function escapeCsv(value) {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildDefaultReportPath(vcfPath) {
  const base = path.basename(vcfPath, path.extname(vcfPath));
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  return path.resolve(process.cwd(), `${base}_import_report_${ts}.csv`);
}

function writeReport(reportPath, rows) {
  const header = [
    'digits',
    'source_name',
    'raw_phone',
    'status',
    'reason',
    'matched_contact_id',
    'match_count',
    'exact_count',
    'fuzzy_count'
  ];
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push([
      escapeCsv(row.digits),
      escapeCsv(row.sourceName),
      escapeCsv(row.rawPhone),
      escapeCsv(row.status),
      escapeCsv(row.reason),
      escapeCsv(row.matchedContactId),
      escapeCsv(row.matchCount),
      escapeCsv(row.exactCount),
      escapeCsv(row.fuzzyCount)
    ].join(','));
  }
  fs.writeFileSync(reportPath, lines.join('\n') + '\n', 'utf8');
}

async function run() {
  const { inputPath, reportEnabled, reportPath } = parseArgs(process.argv);
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

  const numberToEntry = new Map();
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
      const current = numberToEntry.get(digits);
      if (!current) {
        numberToEntry.set(digits, {
          name: candidateName,
          rawPhone
        });
        continue;
      }

      numberToEntry.set(digits, {
        name: pickPreferredName(current.name, candidateName),
        rawPhone: current.rawPhone
      });
    }
  }

  let updates = 0;
  let misses = 0;
  let ambiguous = 0;
  const reportRows = [];
  const reasonCounts = {
    exact_match: 0,
    fuzzy_match: 0,
    no_match: 0,
    too_short_for_fuzzy: 0,
    exact_ambiguous: 0,
    fuzzy_ambiguous: 0
  };

  for (const [digits, entry] of numberToEntry.entries()) {
    const candidateName = entry.name;
    const match = await findContactIdsByDigits(digits);
    if (reasonCounts[match.reason] !== undefined) {
      reasonCounts[match.reason]++;
    }
    const ids = match.ids;
    if (ids.length === 0) {
      misses++;
      if (reportEnabled) {
        reportRows.push({
          digits,
          sourceName: candidateName,
          rawPhone: entry.rawPhone,
          status: 'unmatched',
          reason: match.reason,
          matchedContactId: '',
          matchCount: 0,
          exactCount: match.exactCount,
          fuzzyCount: match.fuzzyCount
        });
      }
      continue;
    }
    if (ids.length > 1) {
      ambiguous++;
      if (reportEnabled) {
        reportRows.push({
          digits,
          sourceName: candidateName,
          rawPhone: entry.rawPhone,
          status: 'ambiguous',
          reason: match.reason,
          matchedContactId: '',
          matchCount: ids.length,
          exactCount: match.exactCount,
          fuzzyCount: match.fuzzyCount
        });
      }
      continue;
    }
    const changed = await updateNameIfBetter(ids[0], candidateName);
    if (changed) updates++;
    if (reportEnabled) {
      reportRows.push({
        digits,
        sourceName: candidateName,
        rawPhone: entry.rawPhone,
        status: changed ? 'updated' : 'matched_no_change',
        reason: match.reason,
        matchedContactId: ids[0],
        matchCount: 1,
        exactCount: match.exactCount,
        fuzzyCount: match.fuzzyCount
      });
    }
  }

  console.log('VCF import complete.');
  console.log('Cards parsed:', cards.length);
  console.log('Unique numbers indexed:', numberToEntry.size);
  console.log('Names skipped (invalid/placeholder):', skippedInvalidName);
  console.log('Contacts updated:', updates);
  console.log('Numbers not matched:', misses);
  console.log('Ambiguous matches skipped:', ambiguous);
  console.log('Match diagnostics:', reasonCounts);

  if (reportEnabled) {
    const outputPath = reportPath ? path.resolve(reportPath) : buildDefaultReportPath(resolvedPath);
    writeReport(outputPath, reportRows);
    console.log('Report written to:', outputPath);
  }
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
