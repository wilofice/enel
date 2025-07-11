# Web Dashboard Usage

The dashboard is available at `http://localhost:3000` once the app starts. It shows:

- **Draft Replies** — messages generated by the LLM that still require approval. Click **Send** to deliver the reply.
- **Outbox Queue** — pending messages ordered by priority. Failed messages can be retried.
- **ASR Job** — start or pause audio transcription from the browser.
- **Jobs** — view recent run information for background jobs.
- **Messages Sent Today** — a list of outgoing messages from the current day.

The page automatically refreshes when new drafts arrive thanks to Socket.io.
