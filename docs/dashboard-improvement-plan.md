# Dashboard Improvement Architecture

This document proposes an architecture to extend the current Express based dashboard.

## Goals
- Review and send AI drafted replies from a browser.
- Display daily message logs and attachment status.
- Control background jobs such as audio transcription.

## Overview
1. **API Server**
   - Continue using Express but split routes into modules under `src/routes`.
   - Provide REST endpoints for drafts, sent messages and job control.
   - Use Socket.io for live updates when a draft is approved or a job state changes.

2. **Web Client**
   - Serve a small static front‑end (plain HTML or a lightweight framework like React).
   - The client polls or listens via Socket.io for new drafts.
   - Actions: approve, edit and send a draft; pause/resume jobs; view messages sent today.

3. **Database Layer**
   - `AiReplies` table already stores draft text and status. Expose queries through a data module.
   - Add an index on `createdAt` to efficiently fetch today’s sent messages.

4. **Flow**
   1. New WhatsApp messages trigger draft generation and save a record in `AiReplies` with status `draft`.
   2. The dashboard’s drafts view lists these records.
   3. When the user approves or edits a draft, the server updates the row, calls `sendMessage` and marks it `sent`.
   4. The page showing today’s messages queries by timestamp and displays results.

5. **Security & Deployment**
   - Protect the dashboard with basic authentication or a reverse proxy.
   - Consider running the dashboard on a separate port or behind HTTPS when deployed.

This modular approach keeps the server small while adding the ability to manage replies and monitor activity from any browser.
