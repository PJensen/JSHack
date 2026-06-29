// cloud/proof/proofBundle.js
// Proof bundle format, validation, and serialization for cryptographic high score verification.
// Pure synchronous module — no crypto, no async. Safe for import anywhere.

export const PROOF_VERSION = 1;

/**
 * Create an empty proof bundle with initial metadata.
 * @param {number} seed - World seed (unsigned 32-bit)
 * @param {string} nonce - Base64-encoded 16 random bytes
 * @returns {object}
 */
export function createEmptyBundle(seed, nonce) {
  return {
    version: PROOF_VERSION,
    engine: "jshack",
    seed: seed >>> 0,
    nonce,
    actions: [],
    chainHash: null,
    score: 0,
    depth: 0,
    turns: 0,
    timestamp: null,
    playerName: null,
    playerClass: null,
    engineVersion: null,
    resumedFromSave: false,
  };
}

/**
 * Produce a deterministic canonical string for an action record.
 * Used by both the recorder and verifier so the hash chain is reproducible.
 * @param {{ turn: number, type: string, payload: object }} action
 * @returns {string}
 */
export function canonicalizeAction(action) {
  return `${action.turn}|${action.type}|${JSON.stringify(action.payload)}`;
}

/**
 * Validate a proof bundle, returning errors if any.
 * @param {object} bundle
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateBundle(bundle) {
  const errors = [];
  if (!bundle || typeof bundle !== "object") {
    return { valid: false, errors: ["bundle is not an object"] };
  }
  if (bundle.version !== PROOF_VERSION) {
    errors.push(`version: expected ${PROOF_VERSION}, got ${bundle.version}`);
  }
  if (bundle.engine !== "jshack") {
    errors.push(`engine: expected "jshack", got ${JSON.stringify(bundle.engine)}`);
  }
  if (typeof bundle.seed !== "number" || !Number.isFinite(bundle.seed) || bundle.seed < 0 || bundle.seed > 0xFFFFFFFF) {
    errors.push(`seed: must be uint32, got ${bundle.seed}`);
  }
  if (typeof bundle.nonce !== "string" || bundle.nonce.length === 0) {
    errors.push("nonce: must be a non-empty string");
  }
  if (!Array.isArray(bundle.actions)) {
    errors.push("actions: must be an array");
  } else {
    for (let i = 0; i < bundle.actions.length; i++) {
      const a = bundle.actions[i];
      if (!a || typeof a !== "object") {
        errors.push(`actions[${i}]: not an object`);
        continue;
      }
      if (typeof a.turn !== "number" || !Number.isFinite(a.turn)) {
        errors.push(`actions[${i}].turn: must be a finite number`);
      }
      if (typeof a.type !== "string" || !a.type) {
        errors.push(`actions[${i}].type: must be a non-empty string`);
      }
      if (a.payload === undefined || a.payload === null || typeof a.payload !== "object") {
        errors.push(`actions[${i}].payload: must be an object`);
      }
    }
  }
  if (bundle.chainHash !== null && (typeof bundle.chainHash !== "string" || !/^[0-9a-f]{64}$/.test(bundle.chainHash))) {
    errors.push("chainHash: must be a 64-char lowercase hex string or null");
  }
  if (typeof bundle.score !== "number" || !Number.isFinite(bundle.score)) {
    errors.push("score: must be a finite number");
  }
  if (typeof bundle.depth !== "number" || !Number.isFinite(bundle.depth)) {
    errors.push("depth: must be a finite number");
  }
  if (typeof bundle.turns !== "number" || !Number.isFinite(bundle.turns)) {
    errors.push("turns: must be a finite number");
  }
  return { valid: errors.length === 0, errors };
}

/**
 * Serialize a bundle to a JSON string.
 * @param {object} bundle
 * @returns {string}
 */
export function serializeBundle(bundle) {
  return JSON.stringify(bundle);
}

/**
 * Deserialize and validate a proof bundle from JSON.
 * @param {string|object} json
 * @returns {object}
 */
export function deserializeBundle(json) {
  const raw = typeof json === "string" ? JSON.parse(json) : json;
  const result = validateBundle(raw);
  if (!result.valid) {
    throw new Error(`Invalid proof bundle: ${result.errors.join(", ")}`);
  }
  return raw;
}
