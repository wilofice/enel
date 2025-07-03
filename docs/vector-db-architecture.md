# Vector Database Integration

This document outlines how to extend the existing WhatsApp AI Auto-Responder with a vector database for semantic search. Past messages will be embedded and stored in a vector store so relevant context can be retrieved efficiently when generating replies.

## Motivation

The current workflow loads a fixed number of recent messages from PostgreSQL. As the history grows, important messages may fall outside this window. Storing embeddings of every message in a vector database lets the system retrieve semantically similar messages regardless of age.

## Components

- **Embedding Service** – A module that converts message text into numerical vectors. It can use a local model (e.g. `all-MiniLM-L6-v2`) or a remote API.
- **ChromaDB** – Chosen vector database. Embeddings are stored with metadata such as the message id, chat id and timestamp.
- **Vector Ingestion Job** – A separate script that scans the Messages table, generates embeddings for new records and upserts them into ChromaDB.
- **Vector Search Utility** – Helper functions that query ChromaDB for the top `k` similar messages given a new message or transcript.
- **Prompt Builder** – Enhanced version of `buildPrompt` that merges results from the standard history query and the vector search.

## Data Flow

1. **Message Logging** – Incoming and outgoing messages continue to be written to PostgreSQL via `message_create`.
2. **Embedding Job** – Periodically run `node src/vectorJob.js` (to be implemented). It
   - reads messages lacking embeddings
   - generates a vector for each using the embedding service
   - stores the vectors in ChromaDB keyed by message id
3. **Draft Generation** – Whenever the LLM is invoked (`draftReply` or profile generation), the following occurs:
   1. retrieve recent history from PostgreSQL as today
   2. run a similarity search against ChromaDB using the new message text
   3. combine these results with the history to form the prompt
   4. send the prompt to the selected LLM engine
4. **Reply Handling** – Replies are approved and sent as before. Relevant vectors remain stored for future queries.

## ChromaDB Querying

Every module that generates LLM output must perform the vector search step before calling the model:

- **`llm.js`** – When building a reply, it will call the vector search utility to fetch additional context.
- **`profileLlm.js`** – When summarising a contact’s profile, it will include semantically similar messages from ChromaDB.
- **Future Plugins or Jobs** – Any new feature that queries an LLM should also query ChromaDB for related content first.

## Deployment Notes

- ChromaDB can run locally in persistent mode or be hosted remotely. The connection URL should be added to `config.json`.
- Embedding vectors should use the same dimensionality across the system.
- The ingestion job can be scheduled with `cron` or triggered at startup similar to `fetchHistory`.

Integrating a vector database in this way ensures that long-term context is accessible without overloading the LLM’s prompt window.
