// shared/proofVerify.js
// Hash chain verifier for proof bundles.
// Works in both Deno and browser (uses Web Crypto API).
// No game engine imports — pure async crypto.

import { canonicalizeAction, validateBundle } from "./proofBundle.js";

const _encoder = new TextEncoder();

/**
 * Verify the SHA-256 hash chain of a proof bundle.
 * Recomputes H_0 through H_n and compares to bundle.chainHash.
 *
 * @param {object} bundle - A ProofBundle object
 * @returns {Promise<{ valid: boolean, errors: string[] }>}
 */
export async function verifyHashChain(bundle) {
  const errors = [];

  // Structural validation first.
  const structural = validateBundle(bundle);
  if (!structural.valid) {
    return { valid: false, errors: structural.errors };
  }

  if (!bundle.chainHash) {
    errors.push("chainHash is null (bundle not finalized)");
    return { valid: false, errors };
  }

  // H_0 = SHA-256(seed|nonce)
  const initData = _encoder.encode(`${bundle.seed >>> 0}|${bundle.nonce}`);
  let hash = new Uint8Array(await crypto.subtle.digest("SHA-256", initData));

  // H_n = SHA-256(H_{n-1} || canonicalizeAction(action_n))
  for (let i = 0; i < bundle.actions.length; i++) {
    const actionStr = canonicalizeAction(bundle.actions[i]);
    const actionBytes = _encoder.encode(actionStr);
    const combined = new Uint8Array(hash.length + actionBytes.length);
    combined.set(hash, 0);
    combined.set(actionBytes, hash.length);
    hash = new Uint8Array(await crypto.subtle.digest("SHA-256", combined));
  }

  // Compare.
  let recomputed = "";
  for (let i = 0; i < hash.length; i++) {
    recomputed += hash[i].toString(16).padStart(2, "0");
  }

  if (recomputed !== bundle.chainHash) {
    errors.push(`chain hash mismatch: computed ${recomputed}, bundle claims ${bundle.chainHash}`);
  }

  return { valid: errors.length === 0, errors };
}
