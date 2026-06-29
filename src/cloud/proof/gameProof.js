// cloud/proof/gameProof.js
// Session recorder with async SHA-256 hash chain.
// Records every player action and maintains a tamper-evident hash chain.
// Async crypto is kept in the cloud layer (never in rules/).

import { createEmptyBundle, canonicalizeAction } from "./proofBundle.js";

const _encoder = new TextEncoder();

/**
 * Convert a Uint8Array hash to a lowercase hex string.
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function hexFromBytes(bytes) {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Compute SHA-256 of the concatenation of a hash prefix and a UTF-8 string suffix.
 * @param {Uint8Array} prefixBytes - Previous hash bytes (32 bytes)
 * @param {string} suffixStr - Canonical action string
 * @returns {Promise<Uint8Array>}
 */
async function chainDigest(prefixBytes, suffixStr) {
  const suffixBytes = _encoder.encode(suffixStr);
  const combined = new Uint8Array(prefixBytes.length + suffixBytes.length);
  combined.set(prefixBytes, 0);
  combined.set(suffixBytes, prefixBytes.length);
  const digest = await crypto.subtle.digest("SHA-256", combined);
  return new Uint8Array(digest);
}

/**
 * Create a GameProof recorder for one play session.
 * @param {number} seed - world.seed
 * @param {{ resumedFromSave?: boolean }} [opts]
 * @returns {Readonly<{ record: (turn:number, type:string, payload:object) => void, finalize: (meta:object) => Promise<object>, getBundle: () => object, getActionCount: () => number }>}
 */
export function createGameProof(seed, opts = {}) {
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = btoa(String.fromCharCode(...nonceBytes));

  const bundle = createEmptyBundle(seed, nonce);
  if (opts.resumedFromSave) bundle.resumedFromSave = true;

  let _currentHash = null;
  let _hashUpToIndex = 0;
  let _finalized = false;

  // Chain promise serializes all async hash work.
  let _chainPromise = Promise.resolve();

  // H_0 = SHA-256(seed|nonce)
  _chainPromise = _chainPromise.then(async () => {
    const initData = _encoder.encode(`${seed >>> 0}|${nonce}`);
    const digest = await crypto.subtle.digest("SHA-256", initData);
    _currentHash = new Uint8Array(digest);
  });

  // Schedules hash catch-up for all unprocessed actions.
  let _catchupScheduled = false;
  function _scheduleHashCatchup() {
    if (_catchupScheduled || _finalized) return;
    _catchupScheduled = true;
    _chainPromise = _chainPromise.then(async () => {
      _catchupScheduled = false;
      while (_hashUpToIndex < bundle.actions.length) {
        const action = bundle.actions[_hashUpToIndex];
        _currentHash = await chainDigest(_currentHash, canonicalizeAction(action));
        _hashUpToIndex++;
      }
    });
  }

  /**
   * Record a player action (synchronous, non-blocking).
   * @param {number} turn
   * @param {string} type
   * @param {object} payload
   */
  function record(turn, type, payload) {
    if (_finalized) return;
    bundle.actions.push({ turn, type, payload: payload || {} });
    _scheduleHashCatchup();
  }

  /**
   * Finalize the proof bundle at game-over.
   * @param {{ score: number, depth: number, turns: number, playerName?: string, playerClass?: string, engineVersion?: string }} meta
   * @returns {Promise<object>}
   */
  async function finalize(meta) {
    if (_finalized) return bundle;
    _finalized = true;

    // Flush any remaining hashes.
    _scheduleHashCatchup();
    await _chainPromise;

    bundle.chainHash = hexFromBytes(_currentHash);
    bundle.score = meta.score ?? 0;
    bundle.depth = meta.depth ?? 0;
    bundle.turns = meta.turns ?? 0;
    bundle.timestamp = new Date().toISOString();
    bundle.playerName = meta.playerName ?? null;
    bundle.playerClass = meta.playerClass ?? null;
    bundle.engineVersion = meta.engineVersion ?? null;

    return bundle;
  }

  return Object.freeze({
    record,
    finalize,
    getBundle: () => bundle,
    getActionCount: () => bundle.actions.length,
    /** Resolves when the initial H_0 digest is ready (useful for tests). */
    get ready() { return _chainPromise; },
  });
}
