# AI Assistant and Message Outbox Jobs

This document describes a proposed architecture for an automated assistant job that drafts replies and a companion job that sends them. The goal is to separate message analysis from message delivery and to monitor both tasks from the dashboard.

## Database Changes

### `Outbox` table
Stores every message that may be sent to WhatsApp.

- `id SERIAL PRIMARY KEY`
- `chatId TEXT` – recipient chat id
- `sourceMessageId TEXT` – optional reference to the incoming message
- `text TEXT` – message body proposed or written by the user
- `origin TEXT` – `ai` or `manual`
- `status TEXT` – `draft`, `queued`, `sent`, `failed`
- `priority INTEGER DEFAULT 1` – higher number is more important
- `attempts INTEGER DEFAULT 0`
- `createdAt TIMESTAMPTZ DEFAULT now()`

### `JobStatus` table
Tracks state for background jobs.

- `job TEXT PRIMARY KEY`
- `lastStart TIMESTAMPTZ`
- `lastEnd TIMESTAMPTZ`
- `lastError TEXT`
- `retries INTEGER DEFAULT 0`

## Assistant Job (`assistantJob.js`)

1. Query the `Messages` table for inbound messages that do not have an entry in `Outbox`.
2. For each message, gather recent history using existing helpers and call `draftReply` from `llm.js`.
3. Insert the generated text into `Outbox` with `origin = 'ai'`,
   `status = 'draft'` and `priority = 1`.
4. Update `JobStatus` so the dashboard knows when the job ran and whether an error occurred.
5. The script can be executed manually with:
   ```bash
   node src/assistantJob.js
   ```
   or scheduled by a master job/cron.

## Send Job (`sendQueueJob.js`)

1. Load entries from `Outbox` where `status = 'draft'` or `status = 'queued'`.
2. Use the WhatsApp client and `sendMessage` helper to deliver each message.
3. On success mark the row `sent` and store the WhatsApp message id.
4. On failure increment `attempts`; if the attempts exceed a limit mark it `failed` so it can be retried manually.
5. Record run information in `JobStatus` as well.

## Dashboard Updates

- Add an endpoint `/jobs` that returns the contents of `JobStatus` and controls to start or pause jobs.
- Extend `public/index.html` to show job names, last run times and whether they are active.
- Provide buttons to retry failed outbox messages.
- List queued `Outbox` messages ordered by `priority` so urgent replies appear first.

## Master Job

A simple script (`masterJob.js`) can sequentially call `assistantJob.run()` and `sendQueueJob.run()`. Individual jobs remain runnable via `node src/jobname.js`.

## Secretary Role

With the assistant job populating the `Outbox`, the dashboard can highlight which incoming messages lack a reply. Pending drafts show their `priority` so the user knows what to address first. Messages can be reviewed, edited and sent via the send job, keeping track of forgotten conversations like a helpful secretary.

