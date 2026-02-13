/**
 * LocalStorageAdapter - Browser localStorage wrapper with error handling
 * Implements storage interface for browser environments
 */
export class LocalStorageAdapter {
  constructor() {
    if (typeof localStorage === 'undefined') {
      throw new Error('LocalStorageAdapter requires localStorage to be available');
    }
  }

  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (err) {
      console.error('LocalStorage getItem failed:', err);
      return null;
    }
  }

  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (err) {
      console.error('LocalStorage setItem failed:', err);
    }
  }

  removeItem(key) {
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.error('LocalStorage removeItem failed:', err);
    }
  }

  clear() {
    try {
      // Clear only tombstone keys to avoid clearing other localStorage data
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('jshack.tombstones.')) {
          keys.push(key);
        }
      }
      keys.forEach(k => localStorage.removeItem(k));
    } catch (err) {
      console.error('LocalStorage clear failed:', err);
    }
  }
}
