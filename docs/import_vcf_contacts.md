# Import Contacts From VCF

Use this script to update WhatsApp contact names in PostgreSQL from a `.vcf` file.

## Run

```bash
node src/importVcfContacts.js /path/to/contacts.vcf
```

## What it does

- Parses `FN`/`N` and `TEL` fields from each vCard.
- Normalizes phone numbers to digits for matching.
- Matches against `Contacts.contactNumber` first (or the numeric part of `Contacts.id`).
- Updates names only when the incoming value is clearly better than the current one.
- Skips ambiguous number matches.
