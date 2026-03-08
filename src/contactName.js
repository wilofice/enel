const JID_SUFFIX_RE = /@(?:c\.us|s\.whatsapp\.net|g\.us|broadcast|newsletter)$/i;
const PURE_PHONE_RE = /^\+?[0-9]{7,}$/;

function sanitizeContactName(rawName, contactId = null) {
  if (rawName === null || rawName === undefined) return null;

  const name = String(rawName).replace(/\s+/g, ' ').trim();
  if (!name || name === '@') return null;
  if (JID_SUFFIX_RE.test(name)) return null;
  if (PURE_PHONE_RE.test(name)) return null;
  if (/^[+0-9().\-\s]{7,}$/.test(name) && name.replace(/[^0-9]/g, '').length >= 7) return null;

  if (contactId) {
    const normalizedId = String(contactId).trim().toLowerCase();
    const normalizedName = name.toLowerCase();
    if (normalizedName === normalizedId) return null;
    const idPrefix = normalizedId.split('@')[0];
    if (idPrefix && normalizedName === idPrefix) return null;
  }

  return name;
}

// Keep existing names unless the incoming value is clearly more descriptive.
const SQL_NAME_PREFERENCE = `
CASE
  WHEN EXCLUDED.name IS NULL THEN Contacts.name
  WHEN Contacts.name IS NULL OR BTRIM(Contacts.name) = '' OR Contacts.name = '@' THEN EXCLUDED.name
  WHEN Contacts.name ~* '@(c[.]us|s[.]whatsapp[.]net|g[.]us|broadcast|newsletter)$' THEN EXCLUDED.name
  WHEN REGEXP_REPLACE(COALESCE(Contacts.name, ''), '[^0-9]', '', 'g') ~ '^[0-9]{7,}$'
    AND REGEXP_REPLACE(EXCLUDED.name, '[^0-9]', '', 'g') !~ '^[0-9]{7,}$' THEN EXCLUDED.name
  WHEN POSITION(' ' IN EXCLUDED.name) > 0
    AND POSITION(' ' IN COALESCE(Contacts.name, '')) = 0
    AND CHAR_LENGTH(EXCLUDED.name) >= CHAR_LENGTH(COALESCE(Contacts.name, '')) + 2 THEN EXCLUDED.name
  WHEN CHAR_LENGTH(EXCLUDED.name) >= CHAR_LENGTH(COALESCE(Contacts.name, '')) + 4 THEN EXCLUDED.name
  ELSE Contacts.name
END
`.trim();

module.exports = { sanitizeContactName, SQL_NAME_PREFERENCE };
