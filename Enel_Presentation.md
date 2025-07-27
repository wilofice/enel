# Enel WhatsApp AI Auto-Responder

## Overview
Enel is a Node.js application that automates WhatsApp communication. It captures messages, drafts AI-powered replies, and lets users approve or edit responses before sending them. The system relies on PostgreSQL for storage and can use either local or cloud-based AI models for transcription and text generation.

## Current Feature Set

### Message Capture and Logging
- **Comprehensive Listener:** Uses `message_create` event from `whatsapp-web.js` to log every incoming and outgoing message, ensuring complete history tracking【F:docs/Features_listen_create.txt†L1-L17】.
- **Media Handling:** Downloads media files and stores their paths in the `Attachments` table as part of the logging workflow【F:init.txt†L20-L24】.

### Audio Transcription
- **Configurable ASR Engines:** Supports local Whisper or cloud-based APIs for audio transcription, selectable via `config.json`【F:init.txt†L18-L22】.
- **Background Job:** `audioJob.js` processes audio attachments asynchronously, with dashboard endpoints to start or pause the job【F:docs/audio-job.md†L1-L16】.

### AI Draft Generation
- **LLM Choice:** Draft replies can be produced using local models via Ollama or cloud services like Google Gemini【F:docs/google-llm.md†L1-L10】.
- **History Context:** Recent conversation history is combined with vector search results to create detailed prompts when generating drafts【F:docs/vector-db-architecture.md†L13-L24】.

### Plugin System
- **Extensible Modules:** Plugins under `src/plugins` can register handlers for incoming or outgoing messages. Plugins are enabled through `config.json` to keep the core lightweight【F:docs/plugin-usage.md†L1-L17】.

### Web Dashboard
- **Live Interface:** Express and Socket.io provide a browser dashboard to approve drafts, view daily message logs, control jobs, and monitor the outbox queue【F:docs/dashboard-webapp.md†L1-L12】.
- **Profile Management:** A separate page allows updating contact profiles stored in the database【F:docs/profile-management.md†L1-L7】.

### Background Jobs
- **Assistant Job:** Automatically drafts replies for new messages and stores them in an `Outbox` table. A separate send job dispatches approved messages, tracking attempts and status【F:docs/assistant-job-architecture.md†L1-L39】.
- **Follow-Up Job:** Identifies unanswered questions or long-inactive contacts and records them in a `FollowUps` table【F:docs/follow-up-job.md†L1-L19】.
- **Profile Job:** Generates relationship summaries for contacts using a dedicated LLM and updates the `Contacts` table【F:docs/profile-job.md†L1-L17】.
- **Vector Ingestion Job:** Periodically embeds messages and stores vectors in ChromaDB for semantic search, enriching AI prompts【F:docs/vector-db-architecture.md†L17-L31】.

### Environment Checks
- **Pre-flight Validation:** `node src/checkEnv.js` verifies required tools and environment variables before starting the app【F:docs/check-env.md†L1-L12】.

## Planned Improvements
The improvement plan proposes several enhancements to increase usability and reliability:
- **User Approval Toggle:** Allow automatic sending of drafts when manual approval is disabled, with retry logic for modifications【F:docs/improvement-plan.md†L1-L10】.
- **Contact Name Storage:** Persist and display contact names, using them in prompts for more natural replies【F:docs/improvement-plan.md†L11-L21】.
- **Link Detection & Message Filtering:** Flag or filter messages containing links and ignore short acknowledgments to reduce noise【F:docs/improvement-plan.md†L22-L30】.
- **Enhanced Context Assembly:** Prioritize recent messages and allow summarization for long histories to stay within token limits【F:docs/improvement-plan.md†L31-L36】.
- **Automatic Contact Updates:** A scheduled job will refresh contact names from WhatsApp to keep the database consistent【F:docs/improvement-plan.md†L37-L39】.
- **Pluggable Workflow & Tests:** Introduce a plugin architecture and a Jest-based test suite for reliability and easier feature expansion【F:docs/improvement-plan.md†L40-L63】.

## Business Value
- **Efficient Communication:** By automating draft creation, Enel reduces response time and enables consistent messaging across conversations.
- **Scalability:** Modular components—plugins, background jobs, and vector search—allow the system to adapt to new workflows and AI models.
- **User Control:** The dashboard and approval workflow keep humans in the loop, ensuring quality responses and compliance with privacy requirements.
- **Data Insights:** Stored conversations, transcripts, and profiles provide valuable analytics on communication patterns.

## Opportunities for Further Development
- **Advanced Dashboard:** Implement a richer web client with editing tools and conversation summaries using the dashboard improvement architecture【F:docs/dashboard-improvement-plan.md†L1-L21】.
- **Automated Deployment:** Containerize the app and integrate cloud-based Postgres and ChromaDB services for easier scaling.
- **Mobile Companion:** Extend the dashboard to a mobile-friendly interface for on-the-go message review.
- **Multilingual Support:** Leverage the ASR job's language detection to automatically translate transcripts and drafts.
- **Analytics Plugins:** Build plugins that analyze sentiment or engagement trends to provide actionable insights.

## Conclusion
Enel combines real-time WhatsApp logging, AI-powered drafts, and a flexible plugin system to streamline communication. With a clear path for improvements—ranging from better context handling to automated jobs—Enel is positioned as a robust solution for managing and optimizing WhatsApp interactions.
