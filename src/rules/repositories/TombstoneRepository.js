import { createStorageAdapter } from './storage/storageFactory.js';

const STORAGE_PREFIX = 'jshack.tombstones.depth.';
const MAX_TOMBSTONES_PER_DEPTH = 20; // Prevent unbounded growth

/**
 * TombstoneRepository - Manages persistence of player death records
 *
 * @typedef {Object} TombstoneRecord
 * @property {string} id - Deterministic identifier (ts_seed_step_hash)
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
  constructor(storageAdapter = null, opts = {}) {
    this._storage = storageAdapter || createStorageAdapter();
    this._getHighscores = typeof opts.getHighscores === 'function' ? opts.getHighscores : null;
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
    const targetCount = Math.max(0, Number(count || 0) | 0);
    const highscores = this._getHighscores ? this._getHighscores() : null;
    if (Array.isArray(highscores) && highscores.length > 0) {
      // Partition: depth-matching first (when API returns depth), then rest
      const depthMatch = [];
      const depthOther = [];
      for (const entry of highscores) {
        if (typeof entry?.depth === 'number' && entry.depth === depth) {
          depthMatch.push(entry);
        } else {
          depthOther.push(entry);
        }
      }
      // Shuffle each partition independently
      for (const arr of [depthMatch, depthOther]) {
        for (let i = arr.length - 1; i > 0; i--) {
          const j = Math.floor(rng.next() * (i + 1));
          [arr[i], arr[j]] = [arr[j], arr[i]];
        }
      }
      // Depth-matching highscores first, then others as filler
      const ordered = depthMatch.concat(depthOther);
      const resolved = ordered.slice(0, targetCount).map((entry, idx) => ({
        id: `global_${depth}_${idx}_${Math.max(0, Number(entry?.score || 0) | 0)}`,
        depth,
        cause: 'highscore',
        deathCause: entry?.deathCause || null,
        killerName: null,
        killerIdentity: null,
        timestamp: 0,
        turn: 0,
        playerName: String(entry?.playerName || 'Hero'),
        className: String(entry?.className || ''),
        score: Math.max(0, Number(entry?.score || 0) | 0),
      }));

      if (resolved.length >= targetCount) return resolved;

      // Supplement with local tombstones (depth-specific, then cross-depth)
      let localFallback = this.getByDepth(depth);
      if (localFallback.length < (targetCount - resolved.length)) {
        const crossDepth = this.getAll();
        const seen = new Set(localFallback.map(r => r.id));
        for (const rec of crossDepth) {
          if (!seen.has(rec.id)) { localFallback.push(rec); seen.add(rec.id); }
        }
      }
      if (localFallback.length <= 0) return resolved;
      const shuffledLocal = [...localFallback];
      for (let i = shuffledLocal.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [shuffledLocal[i], shuffledLocal[j]] = [shuffledLocal[j], shuffledLocal[i]];
      }
      for (const rec of shuffledLocal) {
        if (resolved.length >= targetCount) break;
        resolved.push(rec);
      }
      return resolved;
    }

    // Try depth-specific local tombstones first, then fall back to cross-depth pool
    let all = this.getByDepth(depth);
    if (all.length < targetCount) {
      const crossDepth = this.getAll();
      if (crossDepth.length > all.length) {
        // Merge: depth-specific first, then others (deduped by id)
        const seen = new Set(all.map(r => r.id));
        for (const rec of crossDepth) {
          if (!seen.has(rec.id)) {
            all.push(rec);
            seen.add(rec.id);
          }
        }
      }
    }
    if (all.length === 0) return [];

    // Fisher-Yates shuffle using provided RNG
    const shuffled = [...all];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng.next() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Never return more unique records than exist — prevents duplicates across chunks
    return shuffled.slice(0, Math.min(targetCount, shuffled.length));
  }

  /**
   * Get all tombstone records across every depth
   * @returns {TombstoneRecord[]} Sorted by timestamp descending (most recent first)
   */
  getAll() {
    const all = [];
    try {
      const storage = this._storage;
      // Scan localStorage for all tombstone depth keys
      if (typeof localStorage !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('jshack.tombstones.depth.')) {
            const raw = storage.getItem(key);
            if (raw) {
              try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) all.push(...parsed);
              } catch (e) { console.warn('[TombstoneRepository] corrupt tombstone JSON at', key, e); }
            }
          }
        }
      }
    } catch (e) { console.warn('[TombstoneRepository] getAll scan failed:', e); }
    // Sort by timestamp descending (most recent death first)
    all.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    return all;
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
