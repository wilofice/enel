# Fetching Historical WhatsApp Messages

This script uses `chat.fetchMessages()` from **whatsapp-web.js** to backfill the database with recent chat history. WhatsApp Web only loads messages in small batches, so the script mimics scrolling and cannot pull the full history at once.

## Basic Flow

1. Connect to WhatsApp using `LocalAuth`.
2. Iterate over all chats that are not groups.
3. For each chat, fetch a limited number of past messages (default 200).
4. Save each message and any media to the database using the same logic as the `message_create` listener.
5. Pause a few seconds between chats to reduce ban risk.

## Usage Recommendations

- Run the script sparingly. Fetching large histories frequently can trigger account bans.
- Prioritise important chats rather than fetching every conversation.
- Combine this one-time backfill with the realtime `message_create` listener to capture new messages going forward.

## Weekly Execution

On application start (`npm start`), the app checks when the history fetch last ran. If more than a week has passed, it will perform the fetch again and update the timestamp in the database.

## Risks

Fetching thousands of messages is resource intensive and may be flagged by WhatsApp. Always keep the fetch limit conservative and include delays.
