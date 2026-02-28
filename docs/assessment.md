# Enel — Project Assessment Report

> Generated after 7 months away from the project. The goal of this document is to provide a brutally honest picture of where things stand before any further development begins.

---

## Table of Contents

1. [What the Product Is](#1-what-the-product-is)
2. [Current Architecture](#2-current-architecture)
3. [Feature Inventory](#3-feature-inventory)
4. [Layer-by-Layer Honest Assessment](#4-layer-by-layer-honest-assessment)
5. [Critical Technical Issues](#5-critical-technical-issues)
6. [Security & Dependencies](#6-security--dependencies)
7. [Business Model Analysis](#7-business-model-analysis)
8. [What Actually Works](#8-what-actually-works)
9. [Axes of Improvement](#9-axes-of-improvement)
10. [Recommended Sequence of Work](#10-recommended-sequence-of-work)

---

## 1. What the Product Is

Enel is a Node.js application that acts as an AI-powered personal WhatsApp assistant. It captures incoming messages, stores them, generates AI-drafted replies, and presents those drafts for user approval before sending. It logs everything — messages, media, transcripts — and runs background jobs to enrich that data with LLM-generated contact profiles, follow-up detection, and semantic search indexes.

**The core promise**: you stay in control of every message sent, but AI does the cognitive work of drafting responses.

**The target user today**: a developer running this locally on their own machine, connected to their own WhatsApp account.

**The stated future ambition**: a customizable product usable by other people, not just the developer.

---

## 2. Current Architecture

### System Components

```
                  ┌────────────────────────────────────────┐
                  │             WhatsApp Account           │
                  └──────────────┬─────────────────────────┘
                                 │  (unofficial API)
                         whatsapp-web.js
                                 │
                    ┌────────────▼────────────┐
                    │       waClient.js        │
                    │  (message queue + events)│
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    messageLogger.js      │
                    │  store + download media  │
                    │  + queue transcription   │
                    └──┬──────────────────┬───┘
                       │                  │
              ┌────────▼──────┐   ┌───────▼──────────┐
              │  PostgreSQL   │   │  Filesystem        │
              │  (all state)  │   │  (media files)     │
              └────────┬──────┘   └───────────────────┘
                       │
        ┌──────────────┴──────────────────────────────┐
        │              Background Jobs                  │
        │                                               │
        │  assistantJob  → drafts via LLM               │
        │  sendQueueJob  → deliver approved messages     │
        │  audioJob      → Whisper transcription         │
        │  vectorJob     → embed messages to ChromaDB    │
        │  profileJob    → LLM contact summaries         │
        │  followUpJob   → detect unanswered questions   │
        └──────────────┬──────────────────────────────┘
                       │
              ┌────────▼──────────────────────────┐
              │       dashboard.js                 │
              │  Express + Socket.io               │
              │  (draft approval, job controls)    │
              └────────────────────────────────────┘
```

### LLM Layer

Three supported backends, configured via `config.json`:

| Engine | Provider | Notes |
|--------|----------|-------|
| `local` | Ollama (localhost:11434) | Default. Requires model download (~5–20 GB). |
| `pro` | OpenAI API | Requires `OPENAI_API_KEY`. |
| `google` | Google Gemini API | Requires `GEMINI_API_KEY`. |

### Data Storage

| Store | Purpose |
|-------|---------|
| PostgreSQL | All structured state: messages, contacts, drafts, jobs, outbox, attachments |
| ChromaDB | Vector embeddings for semantic search (currently broken — see §5) |
| Filesystem | Media files organized as `data/{contactId}/{date}/{timestamp}_{id}.{ext}` |

### Database Tables

| Table | Purpose |
|-------|---------|
| `Contacts` | Chat participants with names and AI-generated profiles |
| `Messages` | All messages (incoming + outgoing) with timestamps |
| `Attachments` | Media file paths and MIME types |
| `Transcripts` | Audio transcription results |
| `AiReplies` | Tracking of drafted and sent AI replies |
| `Outbox` | Message queue with status, priority, and retry count |
| `JobStatus` | Background job execution history |
| `FollowUps` | Flagged unanswered questions and stale contacts |
| `VectorMeta` | Tracks which messages have been embedded |
| `FetchMeta` | Timestamp of last history import |

---

## 3. Feature Inventory

| Feature | Status | Notes |
|---------|--------|-------|
| WhatsApp message capture | ✅ Works | Via `whatsapp-web.js` (unofficial) |
| Message storage (PostgreSQL) | ✅ Works | Schema solid, idempotent inserts |
| Media download + storage | ✅ Works | Organized by contact/date |
| Audio transcription (Whisper) | ✅ Works | Local or OpenAI API |
| AI draft generation | ⚠️ Disabled | `generateReplies: false` in default config |
| CLI approval flow | ✅ Works (if enabled) | Real-time, via `inquirer` |
| Web dashboard approval | ✅ Partially works | Separate flow, potential split-brain |
| Vector semantic search | ❌ Broken | Embeddings are hash-based, not semantic |
| Background job scheduling | ❌ Missing | No scheduler wired up |
| Contact profile generation | ✅ Works | LLM-generated summaries |
| Follow-up detection | ⚠️ Crude | Regex on question marks only |
| Plugin system | ✅ Works | Events: `incoming`, `outgoing`, `afterSend` |
| Multi-LLM support | ✅ Works | Ollama, OpenAI, Gemini |
| Dashboard auth (basic) | ✅ Works | Optional HTTP Basic Auth + CSRF |
| History import | ✅ Works | Bulk import from WhatsApp |

---

## 4. Layer-by-Layer Honest Assessment

### WhatsApp Integration (`waClient.js`, `whatsapp-web.js`)

**Rating: 6/10 for personal use, 1/10 for multi-user**

The integration works. Messages are captured, the message queue prevents race conditions, and filters for status messages/broadcasts are in place. For personal use, this is adequate.

The problem is foundational: `whatsapp-web.js` is an unofficial library that reverse-engineers WhatsApp's web interface. WhatsApp actively fights it. Accounts using it get banned. The library breaks with WhatsApp updates and requires emergency patches from the maintainer. Entire features can stop working overnight with no warning.

For a product used by multiple people, this is not a legal or operational foundation. WhatsApp's Terms of Service explicitly prohibit automated bots. You are one ban wave away from the product being dead.

### LLM Layer (`llm.js`, `profileLlm.js`)

**Rating: 7/10**

The multi-provider approach is correct. Abstracting over Ollama, OpenAI, and Gemini behind a single `draftReply()` interface means you can swap backends. The prompt construction is reasonable: persona, contact name, timestamp-annotated history, and the incoming message.

The problems:
1. The "semantic context" injected from vector search is meaningless (see embeddings, §5).
2. No token counting. Long conversations will silently exceed model context windows, causing truncation or errors with no user feedback.
3. Prompt is built with string concatenation — no structured template, hard to maintain.
4. Local LLM calls (`ollama`) block the Node.js event loop for the duration of inference. This is not a problem for personal use but matters at scale.

### Vector Database Layer (`vectorDb.js`, `vectorSearch.js`, `embeddingService.js`)

**Rating: 1/10 — the single biggest technical debt in the project**

The `embeddingService.js` generates "embeddings" like this:

```js
const hash = crypto.createHash('md5').update(tok).digest();
const idx = hash[0] % dim;
vec[idx] += 1;
```

This is a sparse bag-of-words model with MD5 hash-based bucket assignment. It is not semantic. Two messages with opposite meanings but identical vocabularies are represented by the same vector. The entire vector pipeline — ChromaDB, `vectorJob.js`, `vectorSearch.js` — exists to enhance LLM context with "semantically similar" past messages. Because the embeddings are not semantic, this enhancement is random. The infrastructure is real. The benefit is theater.

Additionally, ChromaDB crashes at startup with:
```
Error: Cannot instantiate a collection with the DefaultEmbeddingFunction.
Please install @chroma-core/default-embed
```

`@chroma-core/default-embed` is not in `package.json`. The system works around this by using the custom hash embedder, which hides the error but doesn't fix the underlying design. Anyone cloning the project today will see this error.

**ChromaDB adds zero semantic value and one startup crash. It is the project's most misleading component.**

### Background Jobs (`assistantJob.js`, `sendQueueJob.js`, `audioJob.js`, `vectorJob.js`, `profileJob.js`, `followUpJob.js`)

**Rating: 5/10**

The individual job implementations are reasonable. Each has a clear scope, reads its input from the DB, processes it, and writes its output. The `JobStatus` table tracking is a good pattern.

The critical missing piece: **there is no scheduler**. `masterJob.js` exists as an orchestrator wrapper, but it has key jobs commented out and there is no cron, no event trigger, no interval loop in `index.js` that calls these jobs. For background jobs to run, someone has to run them manually or wire up an external cron. This means the async workflow — which is the primary value proposition of the dashboard — only works if you set up infrastructure that the project doesn't provide.

This is a significant gap between what the code promises and what ships.

### Dashboard (`dashboard.js`, `public/`)

**Rating: 5/10**

The dashboard shows drafts, lets you approve or retry messages, controls the audio job, and shows job statuses. Socket.io real-time updates are the right UX choice for this kind of tool. The CSRF middleware is in place.

The problems:
1. No pagination. `GET /drafts` returns all drafts. A backlog of unanswered messages will make this query expensive and the UI unusable.
2. No draft editing in the dashboard. You can approve or retry, but you can't modify the AI's draft before sending. The CLI flow has this (`confirm.js` opens an editor). The dashboard doesn't.
3. The UI is functionally minimal — plain HTML, no real design. Fine for personal use, not for other users.
4. No request size limits. `express.json()` is called without a `limit`. Large payloads could cause memory pressure.

### Dual Approval Interface

**Rating: 2/10 — architectural confusion**

The project has two parallel approval paths:

- **CLI path**: Message arrives → real-time → `inquirer` prompts → approve/edit/reject → immediate send
- **Dashboard path**: Message arrives → stored in `Outbox` as draft → dashboard shows it → user approves → `sendQueueJob` sends

These are separate systems. A user running both simultaneously will see messages in both places. There is no reconciliation. Approving in the CLI doesn't remove it from the dashboard's queue. Approving in the dashboard won't be seen by the CLI flow.

The root cause is architectural: the CLI flow was built first, then the dashboard was added on top of the `Outbox` table without removing the CLI flow. The product now has two competing interfaces with no defined winner.

**One must go. The dashboard path is the right one for any future beyond personal/local use.**

### Configuration System (`config.js`, `config.json`)

**Rating: 7/10**

The pattern of merging env vars + JSON file + defaults is sensible. The config keys cover the right surface area: LLM engine selection, ASR provider, history length, persona text, feature flags. The `checkEnv.js` pre-flight validation is a good practice.

The issue: `generateReplies` defaults to `false`. The core feature of the product is disabled by default. A new user who runs `npm start` gets a sophisticated message logger and nothing else. The onboarding experience sends entirely the wrong signal about what this product is.

### Test Coverage (`tests/`)

**Rating: 0.5/10**

Two tests. 15 lines. For 1,789 lines of source code.

What's tested:
- `sanitizeText()` — replaces URLs with `[link]`
- `buildPrompt()` — substitutes contact names

What's not tested:
- Message ingestion pipeline
- Database operations (any table, any query)
- LLM engine selection and calling
- History retrieval and deduplication
- Vector embedding or search
- Every background job
- Every dashboard API endpoint
- Error scenarios
- Concurrent message processing
- Plugin system

**You cannot safely refactor this codebase without introducing silent regressions. There is no safety net.**

---

## 5. Critical Technical Issues

### Issue 1: Core Feature Disabled by Default

**File**: `config.json`
```json
"generateReplies": false
```

Every new user who clones and runs the project gets a message logger. The AI drafting — the reason the product exists — requires manual config change. The onboarding is broken.

### Issue 2: Fake Semantic Embeddings

**File**: `src/embeddingService.js`

The vector database enriches LLM prompts with "semantically similar" past messages. The embeddings are computed via MD5 hash-based bag-of-words. They are not semantic. The context enrichment provides no measurable quality improvement. The entire ChromaDB infrastructure, the vectorJob, and the vectorSearch module exist for a feature that doesn't functionally work.

### Issue 3: ChromaDB Startup Crash

**File**: `errors.txt`

```
Error: Cannot instantiate a collection with the DefaultEmbeddingFunction.
Please install @chroma-core/default-embed
```

`@chroma-core/default-embed` is absent from `package.json`. The project currently works around this with the custom hash embedder, which silently installs the broken infrastructure. A fresh install will surface this error.

### Issue 4: No Job Scheduler

**File**: `src/masterJob.js`, `src/index.js`

Key job invocations are commented out in `masterJob.js`. There is no scheduling mechanism — no cron, no setInterval, no external trigger. The async workflow only works if you manually invoke jobs. The dashboard's value proposition (async draft approval) depends on `assistantJob` running, which it doesn't automatically.

### Issue 5: Split Approval Interface

**Files**: `src/confirm.js` (CLI), `src/dashboard.js` (web)

Two independent approval paths with no state coordination. Running both simultaneously creates inconsistency. Approving a message in one path does not invalidate it in the other.

### Issue 6: No Token Budget Management

**File**: `src/llm.js`

Conversation history is passed to the LLM using a record count (`historyLimit`), not a token count. Long conversations with lengthy messages will silently exceed context windows. Different models have different context limits. There is no handling for this case.

### Issue 7: Race Condition Potential in Job Processing

**Files**: `src/assistantJob.js`, `src/audioJob.js`

Multiple jobs can run concurrently. There is no job locking mechanism. If `assistantJob` runs while `audioJob` is writing transcripts, the assistant may draft a reply before the transcript is available, missing audio context.

### Issue 8: No Graceful Shutdown

**File**: `src/db.js`

The PostgreSQL connection pool is never drained on process termination. `process.exit()` is called in some error paths without closing the pool. This can leave connections open on the server, particularly problematic in development with frequent restarts.

---

## 6. Security & Dependencies

### npm Audit (Known CVEs)

Run `npm audit` to see current state. At last audit:

| Severity | Package | Vulnerability |
|----------|---------|---------------|
| High | `minimatch` | Regular Expression DoS (ReDoS) |
| High | `qs` | ArrayLimit bypass — memory exhaustion DoS |
| Moderate | `cookie` | Out-of-bounds character handling |
| Moderate | `js-yaml` | Prototype pollution |
| Moderate | `lodash` | Prototype pollution in `unset`/`omit` |

**Action**: `npm audit fix` will resolve most of these without breaking changes.

### Outdated Dependencies

| Package | Installed | Latest | Gap |
|---------|-----------|--------|-----|
| `inquirer` | 8.2.6 | 13.x | 5 major versions |
| `express` | 4.19.2 | 5.x | 1 major version |
| `dotenv` | 16.3.1 | 17.x | 1 major version |
| `chromadb` | 3.0.6 | 3.3.x | minor |
| `pg` | 8.11.5 | 8.19.x | minor |

### Security Design Observations

**Good:**
- Parameterized SQL queries throughout — SQL injection is not a risk
- CSRF middleware enabled on dashboard
- API keys externalized to `.env`
- Links sanitized before being sent to LLM

**Gaps:**
- No HTTP request size limit on `express.json()` — DoS via large payloads
- No rate limiting on any endpoint
- Dashboard runs HTTP only — basic auth credentials sent in plaintext (acceptable on localhost, not remotely)
- No audit log of which draft was approved by whom (relevant if this becomes multi-user)
- Persona config is string-concatenated directly into LLM prompt — if persona becomes user-editable via UI, this is a prompt injection surface

---

## 7. Business Model Analysis

### Current Reality

Enel is a **personal developer tool**. It works for one person, running on their machine, connected to their personal WhatsApp account. This is its honest current state.

### Path A: Personal Tool / Open Source

**Viability: High**

- Keep `whatsapp-web.js`. The legal risk is accepted by the individual user, who is using it on their own account.
- Focus on Axes 0–5 (see §9).
- Other developers can clone and run it self-hosted.
- No multi-tenancy, no billing, no onboarding complexity.
- This is the correct path if the goal is a useful personal productivity tool that others can also use.

**Risk**: `whatsapp-web.js` can break or get accounts banned. This is an accepted tradeoff for personal use.

### Path B: SaaS Product

**Viability: Conditional — requires significant re-architecture**

For a hosted product where other users sign up:

1. **WhatsApp integration must change.** `whatsapp-web.js` cannot legally or operationally support multiple paying users. Meta's **WhatsApp Business API** (accessed via an approved Business Solution Provider like Twilio, 360dialog, or directly through Meta Cloud API) is the only legitimate path. This is paid per-conversation and requires business verification.

2. **Multi-tenancy is absent.** There is no `userId` column anywhere in the schema. Every query is global. Isolating user data requires either separate databases per user or a full multi-tenant schema retrofit.

3. **Auth is not designed for multi-user.** HTTP basic auth is a single username/password for the dashboard. A multi-user product needs proper session auth (JWT, OAuth, or similar).

4. **The scope is 10× larger.** Adding multi-tenancy, proper auth, WhatsApp Business API integration, billing, and user onboarding is a substantial rebuild on top of the existing codebase — not an incremental addition.

**Recommendation**: Do not begin SaaS development until the personal tool is stable, validated, and you have real user signal that others want it.

### Path C: Undecided (Current State)

The pragmatic path:

- Build and stabilize the personal tool (Axes 0–5).
- Design the schema with future multi-tenancy in mind: add `userId` columns to all tables now (nullable, unused), so the pivot doesn't require a full migration later.
- When you have clarity on direction, the technical pivot is smaller.

---

## 8. What Actually Works

In the interest of balance:

- **Message logging pipeline** is solid. Schema design is clean with proper FK constraints and idempotent inserts.
- **Multi-LLM support** (Ollama, OpenAI, Gemini) is correctly abstracted. Swapping providers is a config change.
- **Audio transcription** (Whisper, local or cloud) is complete and functionally useful.
- **Contact profile generation** via LLM from conversation history is a genuinely differentiated feature.
- **Follow-up detection** is crude (question mark regex) but represents the right kind of intelligence — surfacing what needs attention.
- **Plugin architecture** is clean. The event system (`incoming`, `outgoing`, `afterSend`) is the right abstraction for extensibility.
- **Configuration system** (env vars + JSON + defaults) is well-designed.
- **PostgreSQL schema** has proper audit timestamps, FK constraints, and ON CONFLICT clauses for idempotency.
- **Dashboard + Socket.io** is the correct real-time UX pattern for this type of tool.

The foundation is good. The gaps are in specific layers, not the entire design.

---

## 9. Axes of Improvement

Ordered by impact and prerequisite dependency.

### Axis 0 — Stabilize the Foundation

*Prerequisite for everything else. Do this first.*

- [ ] Run `npm audit fix` — patch known CVEs
- [ ] Add `@chroma-core/default-embed` to `package.json` or explicitly remove the dependency path (see Axis 2)
- [ ] Set `generateReplies: true` as default config, or write an onboarding script that enables it
- [ ] Write a `docker-compose.yml` covering Node.js app + PostgreSQL + ChromaDB — so another person can run this without spending an afternoon on setup
- [ ] Add `express.json({ limit: '1mb' })` to prevent large-payload DoS
- [ ] Implement graceful shutdown (drain DB pool on `SIGTERM`/`SIGINT`)

### Axis 1 — Collapse the Dual Approval Interface

*Remove the split-brain between CLI and web.*

- [ ] Designate the **web dashboard** as the single approval path
- [ ] Remove the CLI real-time approval flow (`confirm.js` as a runtime path)
- [ ] `waClient.js` should never block on `inquirer` — all messages go through `Outbox` → dashboard
- [ ] Add **draft editing** to the dashboard (not just approve/reject)
- [ ] Add **pagination** to `GET /drafts` and `GET /outbox`

The CLI (`inquirer`, `confirm.js`) can remain for setup and admin tasks but should not be in the message processing path.

### Axis 2 — Fix or Eliminate the Vector Database

*The current implementation provides no value. Make a decision.*

**Option A — Real Embeddings (keep ChromaDB):**
- Use Ollama's `/api/embeddings` endpoint (free, already installed if using local LLM)
- Or use OpenAI's `text-embedding-3-small` (~$0.02/1M tokens — essentially free at personal scale)
- This makes semantic search actually work
- Requires replacing `embeddingService.js` entirely

**Option B — pgvector (recommended for simplicity):**
- Drop ChromaDB as an external service
- Install the `pgvector` PostgreSQL extension
- Store embeddings as a vector column on the `Messages` table
- Single database to manage, one fewer moving part, built-in cosine similarity search
- Eliminates the ChromaDB startup error, the `VectorMeta` table, and the `vectorJob.js` complexity

**Option C — Drop vector search entirely:**
- Use only recency-based history (last N messages) for context
- The current hash-based system adds noise, not signal — removing it changes nothing meaningful
- Simplest path, lowest maintenance, honest about capabilities

The hash-based embeddings in ChromaDB are the worst option: complexity without benefit. Pick A, B, or C.

### Axis 3 — Add a Job Scheduler

*Background jobs exist but don't run automatically.*

**Recommended**: `pg-boss` or `graphile-worker`
- Both use PostgreSQL as the job queue backend (no new infrastructure)
- Built-in retry logic, job visibility, concurrency controls
- Replaces the handwritten `JobStatus` table and `masterJob.js`
- Jobs become proper named tasks you schedule and monitor

Alternative: `node-cron` inside the process (simpler, less robust).

Either is infinitely better than the current state of "jobs exist but nothing runs them."

### Axis 4 — Write Integration Tests

*Prerequisite for safe refactoring on Axes 1–3.*

Minimum viable test suite:

```
tests/
  integration/
    message-ingestion.test.js   ← message arrives, stored in DB correctly
    draft-generation.test.js    ← LLM called with correct history/context
    send-flow.test.js           ← draft approved → outbox → sent
    assistant-job.test.js       ← job runs → drafts appear
    dashboard-api.test.js       ← /drafts, /send/:id, /outbox endpoints
```

Without these, every refactor on Axes 1–3 risks silent regressions. Write the tests before touching the core pipeline.

### Axis 5 — Type Safety

*Reduces maintenance cost as the codebase grows.*

**Option A — TypeScript**: Full migration. More investment upfront, strong long-term benefit. Justified if this becomes a multi-user product.

**Option B — JSDoc annotations**: Add `@param` and `@returns` to all public functions. VS Code provides IntelliSense from JSDoc without compilation. Lower investment, most of the developer-experience benefit.

Recommended: Start with JSDoc on all new code. Migrate existing files to TypeScript incrementally if/when you invest in the SaaS path.

### Axis 6 — Multi-User Design (When Direction Is Decided)

*Do not begin this until Axes 0–5 are complete and direction is clear.*

If the decision is **personal/open-source**: skip this axis.

If the decision is **SaaS**:

1. Replace `whatsapp-web.js` with WhatsApp Business API (via a BSP or Meta Cloud API directly)
2. Add `userId` column to all tables; make all queries tenant-scoped
3. Replace HTTP Basic Auth with proper session auth (JWT, Auth0, Clerk, etc.)
4. Add user management, billing, and onboarding flows
5. Containerize with per-tenant isolation strategy

Preparation you can do now (regardless of decision):
- Add nullable `userId` columns to all tables. This costs nothing and makes the future pivot significantly cheaper.

---

## 10. Recommended Sequence of Work

```
Phase 1 — Foundation (do this now, before anything else)
  ├── npm audit fix
  ├── Fix ChromaDB dependency OR decide which vector option to take
  ├── Set generateReplies: true as default
  ├── Write docker-compose.yml
  └── Add graceful shutdown

Phase 2 — Test Safety Net
  ├── Write message ingestion integration test
  ├── Write draft generation integration test
  ├── Write send flow integration test
  └── Write basic dashboard API tests

Phase 3 — Collapse Dual Interface
  ├── Remove CLI approval from message processing path
  ├── Add draft editing to dashboard
  └── Add pagination to all list endpoints

Phase 4 — Fix Vector Layer
  └── Implement chosen option (real embeddings / pgvector / remove)

Phase 5 — Add Job Scheduler
  └── Wire up pg-boss or graphile-worker for background jobs

Phase 6 — Type Safety
  └── JSDoc on all modules, TypeScript on new code

Phase 7 — Direction Decision
  └── Personal/OSS: ship Phases 1-6, publish
  └── SaaS: begin WhatsApp Business API evaluation + multi-tenancy design
```

**Do not start Phase 3 without completing Phase 2. Do not start Phase 7 without completing Phase 5.** The order matters because each phase removes a source of ambiguity or risk that would otherwise make the next phase harder.

---

*Report generated from static code analysis of the `ecstatic-chatelet` worktree. Findings based on reading all source files in `src/`, `tests/`, `public/`, `docs/`, `package.json`, `config.json`, `chromaconfig.yaml`, and `errors.txt`.*
