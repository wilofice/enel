# Plugin System

A simple plugin layer lets you extend the auto-responder without modifying core files.

Plugins live under `src/plugins` and export an `init` function. During startup, `pluginManager.js` loads enabled plugins from this directory. A plugin can register handlers for incoming messages via `onIncoming` and react to `outgoing` or `afterSend` events.

Enable plugins by listing their names in `config.json`:

```json
{
  "plugins": ["logger"]
}
```

Example plugin `logger.js` simply logs every incoming message id.
