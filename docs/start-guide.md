# Getting Started with Enel

This guide explains how to install and run the WhatsApp AI auto-responder.

## Installation

1. Install **Node.js 20** or later and **npm**.
2. Clone the repository and run `npm install` in the project directory.
3. Copy `.env.example` to `.env` and set `DATABASE_URL` to your PostgreSQL connection.
4. Review `config.json` for non secret settings. Important fields include:
   - `whisperModel` – local Whisper model name (e.g. `base`).
   - `chromaUrl` – URL of the ChromaDB instance for vector search.
5. If PostgreSQL is not available locally, run one quickly with Docker:
   ```bash
   docker run --name enel-postgres -e POSTGRES_PASSWORD=pass -p 5432:5432 -d postgres
   ```

## Running

1. Ensure the database is accessible and any required API keys are set.
2. Initialize tables and run the app:
   ```bash
   node src/setupDb.js
   npm start
   ```
3. To populate the vector store after messages are logged, execute:
   ```bash
   node src/vectorJob.js
   ```
4. Profiles for contacts can be generated with `node src/profileJob.js`.

## Tips and Caveats

- Keep the phone connected to the internet while the bot is running.
- Avoid running multiple instances simultaneously as WhatsApp may block the session.
- ChromaDB must be running and reachable at the URL specified in `config.json`.
- The Whisper CLI should be installed when using the local ASR engine.


