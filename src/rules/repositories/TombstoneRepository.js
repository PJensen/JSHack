import { createStorageAdapter } from './storage/storageFactory.js';

const STORAGE_PREFIX = 'jshack.tombstones.depth.';
const MAX_TOMBSTONES_PER_DEPTH = 20; // Prevent unbounded growth

/**
 * TombstoneRepository - Manages persistence of player death records
 *
 * @typedef {Object} TombstoneRecord
 * @property {string} id - Unique identifier (ts_timestamp_random)
 * @property {number} depth - Floor number where death occurred
 * @property {string} cause - Cause of death ('combat', 'starvation', 'trap', etc.)
 * @property {string|null} killerName - Name of killer entity (null for environmental)
 * @property {string|null} killerIdentity - Identity string of killer (null for environmental)
 * @property {number} timestamp - Unix timestamp of death
 * @property {number} turn - Game turn when death occurred
 * @property {string} playerName - Player name ('Hero' for now, real name later)
 */
export class TombstoneRepository {
  /**
   * @param {Object} [storageAdapter] - Optional storage adapter (auto-detected if not provided)
   */
  constructor(storageAdapter = null) {
    this._storage = storageAdapter || createStorageAdapter();
  }

  /**
   * Save a tombstone record
   * @param {TombstoneRecord} record
   */
  save(record) {
    if (!record || typeof record.depth !== 'number') {
      throw new Error('Invalid tombstone record: depth required');
    }

    const key = STORAGE_PREFIX + record.depth;
    const existing = this._getTombstonesForDepth(record.depth);

    // Add new record at the beginning (most recent first)
    existing.unshift(record);

    // Limit to MAX_TOMBSTONES_PER_DEPTH to prevent unbounded growth
    const trimmed = existing.slice(0, MAX_TOMBSTONES_PER_DEPTH);

    try {
      this._storage.setItem(key, JSON.stringify(trimmed));
    } catch (err) {
      console.error('Failed to save tombstone:', err);
    }
  }

  /**
   * Get all tombstones for a specific depth
   * @param {number} depth
   * @returns {TombstoneRecord[]}
   */
  getByDepth(depth) {
    return this._getTombstonesForDepth(depth);
  }

  /**
   * Get N random tombstones for a depth (for spawning)
   * @param {number} depth
   * @param {number} count
   * @param {Object} rng - RNG instance with next() method
   * @returns {TombstoneRecord[]}
   */
  getRandomForDepth(depth, count, rng) {
    const all = this.getByDepth(depth);
    if (all.length === 0) return [];

    // Fisher-Yates shuffle using provided RNG
    const shuffled = [...all];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, count);
  }

  /**
   * Clear all tombstones (useful for testing)
   */
  clearAll() {
    this._storage.clear();
  }

  /**
   * @private
   * @param {number} depth
   * @returns {TombstoneRecord[]}
   */
  _getTombstonesForDepth(depth) {
    const key = STORAGE_PREFIX + depth;
    const raw = this._storage.getItem(key);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error('Failed to parse tombstone data:', err);
      return [];
    }
  }
}
