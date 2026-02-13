/**
 * Message types for color-coding and categorization
 * @typedef {'combat'|'deity'|'ambient'|'system'|'default'} MessageType
 */

/**
 * @typedef {Object} MessageEntry
 * @property {string} text - The message text
 * @property {MessageType} type - The message type
 * @property {number} [timestamp] - Optional timestamp
 */

export function createMessageLog({ maxEntries = 50, onUpdate = null } = {}) {
  const entries = [];

  /**
   * Log a message with optional type
   * @param {string | MessageEntry} msg - Message string or object with text and type
   */
  function log(msg) {
    let entry;

    // Support both plain strings (backward compatible) and typed message objects
    if (typeof msg === 'string') {
      entry = { text: msg, type: 'default' };
    } else if (msg && typeof msg === 'object' && typeof msg.text === 'string') {
      entry = {
        text: msg.text,
        type: msg.type || 'default',
        timestamp: msg.timestamp || Date.now()
      };
    } else {
      entry = { text: String(msg), type: 'default' };
    }

    entries.push(entry);
    if (entries.length > maxEntries) entries.shift();
    if (typeof onUpdate === "function") onUpdate(entries.slice());
  }

  function getEntries() {
    return entries.slice();
  }

  return Object.freeze({ log, getEntries });
}
