const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');

class PluginManager extends EventEmitter {
  constructor({ client, db, config }) {
    super();
    this.client = client;
    this.db = db;
    this.config = config;
    this.plugins = [];
  }

  loadPlugins() {
    const dir = path.join(__dirname, 'plugins');
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
    const available = files.map(f => path.basename(f, '.js'));
    const wanted = Array.isArray(this.config.plugins) && this.config.plugins.length > 0 ? this.config.plugins : available;
    for (const name of wanted) {
      if (!available.includes(name)) {
        console.warn('Plugin', name, 'not found');
        continue;
      }
      try {
        const plugin = require(path.join(dir, name + '.js'));
        if (plugin && typeof plugin.init === 'function') {
          plugin.init({
            client: this.client,
            db: this.db,
            config: this.config,
            onIncoming: handler => this.on('incoming', handler)
          });
          this.plugins.push(plugin);
          console.log('Loaded plugin', name);
        }
      } catch (err) {
        console.error('Failed to load plugin', name, err.message);
      }
    }
  }
}

module.exports = PluginManager;
