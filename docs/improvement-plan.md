# WhatsApp AI Auto-Responder: Proposed Improvements

This document summarizes planned enhancements to the WhatsApp AI auto-responder. The proposals draw inspiration from the repositories [whatsapp-bot](https://github.com/lyfe00011/whatsapp-bot/tree/master/plugins) and [whatsapp-chatgpt](https://github.com/askrella/whatsapp-chatgpt).

## 0. Configurable user approval feature for AI generated messages in settings
- Default is true to enforce user approbation before sending messages
- Add a retry policy with the ability for the user to indicate to the LLM what to change in the generated messages.
- Add also a configurable option to turn on or off the generation of the messages to reply.

## 1. Persist Contact Names
- Store the sender's display name (e.g., `notifyName` or `pushName`) in the `Contacts` table when messages arrive.
- Update existing entries with new names using `ON CONFLICT` to keep the database accurate.
- Access these names when building prompts and when displaying message logs.

## 2. Use Contact Names in LLM Prompts
- Modify `buildPrompt` in `src/llm.js` so that messages from contacts are labeled with their name instead of the generic "Contact" label.
- Retrieve the contact name from the database (fall back to the incoming message's `notifyName` if none exists).
- This adds clearer context for the LLM and results in more natural replies.

## 3. Detect and Handle Links
- Add a helper in `waClient.js` that detects URLs using a regex like `/https?:\/\S+/i`.
- Mark messages containing links so that prompts can replace them with `[link]` or a short summary.
- Optionally log suspicious or repeated links for manual review.

## 4. Configurable Message Filtering
- Extend the existing `isRealContactMessage` logic to ignore short acknowledgments (e.g., "OK"), newsletter senders, or contacts not present in the database.
- Allow users to tweak these rules in `config.json`.

## 5. Improved Context Assembly
- Refine `history.js` to prioritize recent messages or collapse duplicates.
- Implement optional summarization for long histories to keep prompts within token limits.

## 6. Background Job for Contact Name Updates
- Create `src/updateContacts.js` to periodically refresh contact names using the WhatsApp client.
- Run this job after startup so stored names stay in sync with WhatsApp.

## 7. Pluggable Workflow
The code base is relatively small, so adding new features directly to `waClient.js`
or `index.js` can quickly become messy. Borrowing the idea from the
`whatsapp-bot` repository, we can introduce a simple plugin layer so that extra
behaviour lives in its own module.

### Design Outline
1. **Plugin Interface** – Each plugin is a Node module under `src/plugins` that
   exports an `init` function. The signature could be
   `init({ client, db, config, onIncoming })` where `onIncoming` allows the
   plugin to register a handler for incoming messages.
2. **Plugin Loader** – `src/pluginManager.js` reads all `*.js` files in the
   plugin directory and calls their `init` function. Errors should not crash the
   app; failed plugins are logged and skipped.
3. **Hook Points** – The manager exposes events such as `incoming`, `outgoing`
   and `afterSend`. Core modules emit these events so plugins can react without
   modifying the main logic.
4. **Configuration** – `config.json` lists which plugins are enabled. A simple
   array of plugin names keeps startup predictable.

### Example Usage
```
plugins/
  autoGreeter.js
  moderation.js
```
`autoGreeter.js` could check the first message from a contact and queue a
friendly greeting. `moderation.js` might look for banned words or links before
a reply is drafted.

This approach keeps the core workflow small while letting advanced users drop in
new functionality. Plugins can be added or removed without touching existing
files, and larger features can be prototyped independently before merging into
the main code.

## 8. Automated Tests
- Introduce Jest-based tests for prompt construction, link detection, and contact-name storage.
- Use a test database and a mock WhatsApp client to ensure repeatable results.

## External Inspiration
We reviewed the referenced repositories using `git ls-remote` to explore their structure and features. The plugin architecture and message handling patterns informed the improvements above.

