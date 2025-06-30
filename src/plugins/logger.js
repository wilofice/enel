function init({ onIncoming }) {
  onIncoming(msg => {
    console.log('[Plugin logger] incoming', msg.id?._serialized || msg.id);
  });
}

module.exports = { init };
