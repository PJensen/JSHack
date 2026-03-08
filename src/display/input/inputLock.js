const INPUT_LOCKS_KEY = Symbol.for('jshack:display:inputLocks');

function getHost() {
  if (typeof window !== "undefined") return /** @type {any} */ (window);
  return /** @type {any} */ (globalThis);
}

function ensureLocks(host) {
  if (host[INPUT_LOCKS_KEY] instanceof Set) return host[INPUT_LOCKS_KEY];
  const locks = new Set();
  host[INPUT_LOCKS_KEY] = locks;
  return locks;
}

function syncFlag(host, locks) {
  const locked = locks.size > 0;
  host.__JSHACK_INPUT_LOCKED = locked;
  return locked;
}

export function setInputLock(key, locked) {
  const token = String(key || "").trim();
  const host = getHost();
  const locks = ensureLocks(host);
  if (!token) return syncFlag(host, locks);
  if (locked) locks.add(token);
  else locks.delete(token);
  return syncFlag(host, locks);
}

export function isInputLocked() {
  const host = getHost();
  const locks = ensureLocks(host);
  return syncFlag(host, locks);
}

