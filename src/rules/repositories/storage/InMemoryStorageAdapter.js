/**
 * InMemoryStorageAdapter - Map-based storage for headless/test environments
 * Implements storage interface using an in-memory Map
 */
export class InMemoryStorageAdapter {
  constructor() {
    this._store = new Map();
  }

  getItem(key) {
    return this._store.get(key) || null;
  }

  setItem(key, value) {
    this._store.set(key, value);
  }

  removeItem(key) {
    this._store.delete(key);
  }

  clear() {
    this._store.clear();
  }
}
