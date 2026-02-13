export function createMessageLog({ maxEntries = 50, onUpdate = null } = {}) {
  const entries = [];

  function log(msg) {
    entries.push(String(msg));
    if (entries.length > maxEntries) entries.shift();
    if (typeof onUpdate === "function") onUpdate(entries.slice());
  }

  function getEntries() {
    return entries.slice();
  }

  return Object.freeze({ log, getEntries });
}
