# WhatsApp AI Auto-Responder

This project provides a personal WhatsApp auto-responder powered by Node.js. Incoming messages are logged, media is saved, audio is optionally transcribed, and a Large Language Model (LLM) drafts replies. The user can approve or edit the suggested reply before it is sent.

The architecture and best practices are based on the blueprint in [`init.txt`](init.txt).
Vector database usage is described in [docs/vector-db-architecture.md](docs/vector-db-architecture.md).

## Quick Start

1. Install [Node.js](https://nodejs.org/) v20 or later.
2. Clone this repository and run `npm install`.
3. Copy `.env.example` to `.env` and update the PostgreSQL connection string and any API keys.
4. Edit `config.json` if you want to change non-secret settings such as the LLM
   engine, model, or persona string.
5. (Optional) verify prerequisites with `node src/checkEnv.js`.
6. If you don't have PostgreSQL installed, you can run a temporary instance using Docker:
   `docker run --name enel-postgres -e POSTGRES_PASSWORD=pass -p 5432:5432 -d postgres`
7. Run `npm start` to launch the app and create the database tables if needed.
8. To build contact profiles from chat history, run `node src/profileJob.js`.
9. See [docs/start-guide.md](docs/start-guide.md) for detailed usage tips.

## Roadmap

The following tasks break down the full implementation into small steps. Each task lists the expected input, output, guidelines, and a functional test scenario.

### Task 1: Basic project setup
- **Input:** Node.js 20+ environment.
- **Output:** Project folder with `package.json`, `.gitignore`, and `src/index.js`.
- **Guidelines:** Use CommonJS modules and keep dependencies minimal.
- **Expectations:** Running `npm start` prints a startup message.
- **Testing:** Execute `npm start` and verify the console output.

### Task 2: Configuration management
- **Input:** `.env` file for secrets and `config.json` for settings.
- **Output:** A module that loads both at startup.
- **Guidelines:** Do not commit secrets. Provide defaults for non-secret settings.
- **Expectations:** Application reads configuration without errors.
- **Testing:** Start the app with sample config files and confirm values are loaded.

### Task 3: Database connection
- **Input:** PostgreSQL connection string from `.env`.
- **Output:** Database module using the `pg` package.
- **Guidelines:** Handle connection errors gracefully.
- **Expectations:** Successful connection on app start.
- **Testing:** Run the module and check that the connection resolves.

### Task 4: Database schema
- **Input:** SQL definitions for Contacts, Messages, Attachments, Transcripts, and AiReplies tables.
- **Output:** Migration or setup script that creates these tables.
- **Guidelines:** Include foreign keys as described in `init.txt`.
- **Expectations:** Tables exist in PostgreSQL.
- **Testing:** Run the script on a fresh database and verify table creation.

### Task 5: WhatsApp client initialization
- **Input:** `whatsapp-web.js` with LocalAuth.
- **Output:** Client that connects and emits events.
- **Guidelines:** Display QR code on first run and store session data.
- **Expectations:** Client shows "ready" once logged in.
- **Testing:** Launch the app, scan the QR code, and ensure connection succeeds.

### Task 6: Message ingestion
- **Input:** Incoming WhatsApp messages.
- **Output:** Message records inserted into the `Messages` table.
- **Guidelines:** Capture message id, chat id, timestamp, and body.
- **Expectations:** Every received message is stored.
- **Testing:** Send a test message and check the database entry.

### Task 7: Media handling
- **Input:** Messages containing media.
- **Output:** Downloaded files saved to `baseFolder/{contact}/{date}/{timestamp}_{id}.ext` and a record in `Attachments`.
- **Guidelines:** Create folders automatically and store absolute paths.
- **Expectations:** Media files are persisted and referenced in the database.
- **Testing:** Send an image or voice note and verify the saved file and DB row.

### Task 8: Audio transcription
- **Input:** Saved audio file path.
- **Output:** Transcript text via local Whisper or a cloud API.
- **Guidelines:** Choose provider based on configuration and store transcripts only above a confidence threshold.
- **Expectations:** Audio messages produce transcript entries.
- **Testing:** Send a voice message and ensure a transcript row appears with the chosen ASR engine.

### Task 9: Conversation history retrieval
- **Input:** Chat ID of the message thread.
- **Output:** Array of the most recent messages from the database.
- **Guidelines:** Order by timestamp and limit to a configurable number.
- **Expectations:** History is returned for prompt creation.
- **Testing:** Call the function and confirm it returns the expected messages.

### Task 10: LLM draft generation
- **Input:** Persona settings, conversation history, and new message or transcript.
- **Output:** Draft reply text from the selected LLM.
- **Guidelines:** Support both local models (via Ollama) and pro models (e.g., Gemini API).
- **Expectations:** Function returns a coherent draft reply.
- **Testing:** Provide sample history and verify the LLM returns a non-empty draft.
This functionality is implemented in `src/llm.js`.

### Task 11: CLI user confirmation
- **Input:** Draft reply text.
- **Output:** Final message text after the user chooses approve, reject, or edit.
- **Guidelines:** Use `inquirer` to prompt the user.
- **Expectations:** User decision is captured correctly.
- **Testing:** Run the CLI flow and exercise each option to ensure correct behavior.
This functionality is implemented in `src/confirm.js`.

### Task 12: Send message
- **Input:** Approved message text and original message reference.
- **Output:** Message sent via WhatsApp and status logged in `AiReplies`.
- **Guidelines:** Only send after explicit approval.
- **Expectations:** Sent messages appear in WhatsApp and the database reflects the action.
- **Testing:** Approve a reply and confirm delivery plus database update.
This functionality is implemented in `src/send.js`.

### Task 12.1: Automated reply workflow
- **Input:** Incoming WhatsApp messages.
- **Output:** LLM draft, user confirmation prompt, and the final message sent and logged.
- **Guidelines:** Queue messages to avoid overlapping prompts. After storing the message and any transcript, retrieve history, generate a draft reply with the LLM, ask the user for approval using the CLI, and then send the reply with `src/send.js`.
- **Expectations:** Multiple incoming messages are processed sequentially without skipping confirmation.
- **Testing:** Send several messages quickly and verify each draft appears for approval and the replies are delivered in order.
This functionality is implemented in `src/waClient.js`.

### Task 13: Error handling and retry logic
- **Input:** Failures from network requests or database operations.
- **Output:** Robust retry behavior with exponential backoff.
- **Guidelines:** Wrap I/O in `try...catch` blocks and log errors.
- **Expectations:** Temporary errors are retried without crashing the app.
- **Testing:** Simulate an error (e.g., disconnect the network) and observe the retry attempts.

### Task 14: Web dashboard (phase 2)
- **Input:** Express server and Socket.io.
- **Output:** Simple dashboard for reviewing messages and approving drafts. In this scenario, we must implement a change : the AI drafts are automatically saved in the database and later when the user is available, he can look into each draft messages, validate and send them. Also view of all messages sent in the day. 
- **Guidelines:** Keep the UI minimal while mirroring CLI functionality.
- **Expectations:** Users can manage replies from the browser.
- **Testing:** Start the server, open the dashboard, and approve a draft message.

### Task 15: Automated tests
- **Input:** Test framework such as Jest.
- **Output:** Unit tests for helper functions and integration tests for the end-to-end flow.
- **Guidelines:** Use a separate test database and WhatsApp test number.
- **Expectations:** Tests run without external side effects and all pass.
- **Testing:** Execute `npm test` and ensure all suites complete successfully.

---

These tasks provide a structured roadmap to build the WhatsApp AI Auto-Responder from the ground up while following the architecture described in `init.txt`.

