import { LocalStorageAdapter } from './LocalStorageAdapter.js';
import { InMemoryStorageAdapter } from './InMemoryStorageAdapter.js';

/**
 * Create appropriate storage adapter based on environment
 * Automatically detects if localStorage is available and usable
 * @returns {LocalStorageAdapter|InMemoryStorageAdapter}
 */
export function createStorageAdapter() {
  if (typeof localStorage !== 'undefined') {
    try {
      // Test if localStorage is actually usable (some browsers block it)
      localStorage.setItem('jshack.test', 'test');
      localStorage.removeItem('jshack.test');
      return new LocalStorageAdapter();
    } catch {
      // Fall through to in-memory
    }
  }
  return new InMemoryStorageAdapter();
}
