// rules/environment/dungeon/perceptionMemory.js
// Player-centric recent-contact memory for out-of-FOV perception channels.

import { PERCEPTION_TUNING } from "./perceptionTuning.js";

const DEFAULT_MEMORY_TTL_TURNS = PERCEPTION_TUNING.memoryTtlTurns;

/** @typedef {{ x:number, y:number, kind:string, layer:number, lastSeenTurn:number }} PerceptionMemoryEntry */

/** @type {Map<number, Map<number, PerceptionMemoryEntry>>} depth -> (entityId -> entry) */
const _memoryByDepth = new Map();

function normalizeDepth(depth) {
  return Number.isInteger(depth) ? depth : (Number(depth || 0) | 0);
}

function normalizeEntityId(entityId) {
  return Number(entityId || 0) | 0;
}

/**
 * @param {number} depth
 * @param {boolean} create
 * @returns {Map<number, PerceptionMemoryEntry>|null}
 */
function depthMap(depth, create = false) {
  const key = normalizeDepth(depth);
  let map = _memoryByDepth.get(key);
  if (!map && create) {
    map = new Map();
    _memoryByDepth.set(key, map);
  }
  return map || null;
}

function mix32(n) {
  let x = n | 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

function seeded01(seed, salt) {
  const h = mix32((seed | 0) ^ (salt | 0));
  return h / 0x100000000;
}

function seededInt(seed, salt, min, max) {
  const lo = Math.min(min, max) | 0;
  const hi = Math.max(min, max) | 0;
  const span = (hi - lo + 1) | 0;
  if (span <= 1) return lo;
  return lo + ((mix32((seed | 0) ^ (salt | 0)) % span) | 0);
}

/**
 * @param {number} depth
 * @param {number} turn
 * @param {number} ttl
 */
export function gcPerceptionMemory(depth, turn, ttl = DEFAULT_MEMORY_TTL_TURNS) {
  const map = depthMap(depth, false);
  if (!map || map.size <= 0) return;
  const now = Number(turn || 0) | 0;
  const keepFor = Math.max(1, Number(ttl || DEFAULT_MEMORY_TTL_TURNS) | 0);
  for (const [id, entry] of map.entries()) {
    const age = now - (Number(entry?.lastSeenTurn || 0) | 0);
    if (age > keepFor) map.delete(id);
  }
}

export function clearPerceptionMemory() {
  _memoryByDepth.clear();
}

/**
 * @param {number} depth
 * @param {number} entityId
 * @param {{ x:number, y:number, kind:string, layer?:number, lastSeenTurn:number }} contact
 */
export function rememberPerceptionContact(depth, entityId, contact) {
  const id = normalizeEntityId(entityId);
  if (!(id > 0)) return;
  const map = depthMap(depth, true);
  if (!map) return;
  map.set(id, {
    x: Number(contact?.x || 0) | 0,
    y: Number(contact?.y || 0) | 0,
    kind: String(contact?.kind || "default"),
    layer: Number.isFinite(Number(contact?.layer)) ? (Number(contact.layer) | 0) : 300,
    lastSeenTurn: Number(contact?.lastSeenTurn || 0) | 0,
  });
}

/**
 * @param {number} depth
 * @param {number} entityId
 */
export function forgetPerceptionContact(depth, entityId) {
  const id = normalizeEntityId(entityId);
  if (!(id > 0)) return;
  const map = depthMap(depth, false);
  if (!map) return;
  map.delete(id);
}

/**
 * @param {number} depth
 * @param {number} turn
 * @param {{ ttl?:number }} [opts]
 * @returns {string[]}
 */
export function listPerceptionKinds(depth, turn, opts = {}) {
  const map = depthMap(depth, false);
  if (!map || map.size <= 0) return [];
  const ttl = Math.max(1, Number(opts?.ttl ?? DEFAULT_MEMORY_TTL_TURNS) | 0);
  const now = Number(turn || 0) | 0;
  /** @type {Set<string>} */
  const out = new Set();
  for (const entry of map.values()) {
    const age = now - (Number(entry?.lastSeenTurn || 0) | 0);
    if (age < 0 || age > ttl) continue;
    const kind = String(entry?.kind || "").trim();
    if (kind) out.add(kind);
  }
  return Array.from(out.values());
}

/**
 * @param {number} depth
 * @param {number} entityId
 * @param {number} turn
 * @param {{ ttl?:number, seed?:number, tamperStrength?:number, kindPool?:string[] }} [opts]
 * @returns {(PerceptionMemoryEntry & { age:number, confidence:number, tampered:boolean }) | null}
 */
export function projectPerceptionContact(depth, entityId, turn, opts = {}) {
  const id = normalizeEntityId(entityId);
  if (!(id > 0)) return null;
  const map = depthMap(depth, false);
  if (!map) return null;
  const entry = map.get(id);
  if (!entry) return null;

  const now = Number(turn || 0) | 0;
  const lastSeenTurn = Number(entry.lastSeenTurn || 0) | 0;
  const age = Math.max(0, now - lastSeenTurn);
  const ttl = Math.max(1, Number(opts?.ttl ?? DEFAULT_MEMORY_TTL_TURNS) | 0);
  if (age > ttl) return null;

  const confidence = Math.max(0, 1 - (age / (ttl + 1)));
  const base = {
    x: entry.x | 0,
    y: entry.y | 0,
    kind: String(entry.kind || "default"),
    layer: Number(entry.layer || 300) | 0,
    lastSeenTurn,
    age,
    confidence,
    tampered: false,
  };

  const tamperStrength = Math.max(0, Number(opts?.tamperStrength || 0));
  if (tamperStrength <= 0 || age <= 0) return base;

  const seed = (Number(opts?.seed || 0) | 0)
    ^ Math.imul(now | 0, 0x9e3779b1)
    ^ Math.imul(id | 0, 0x85ebca6b)
    ^ Math.imul(lastSeenTurn | 0, 0x27d4eb2d);

  const tamperChance = Math.min(0.92, 0.12 * tamperStrength + age * 0.025);
  const forceTamper = tamperStrength >= 6;
  if (!forceTamper && seeded01(seed, 0x4d45504d) >= tamperChance) return base;

  const jitter = Math.min(2, 1 + ((tamperStrength | 0) >= 2 ? 1 : 0));
  const dx = seededInt(seed, 0x1001, -jitter, jitter);
  const dy = seededInt(seed, 0x1002, -jitter, jitter);

  let kind = base.kind;
  const kindPool = Array.isArray(opts?.kindPool) ? opts.kindPool.filter(Boolean) : [];
  if (kindPool.length > 1) {
    const swapChance = Math.min(0.7, 0.16 * tamperStrength + 0.18);
    if (seeded01(seed, 0x1003) < swapChance) {
      const pick = seededInt(seed, 0x1004, 0, kindPool.length - 1);
      kind = String(kindPool[pick] || kind);
    }
  }

  return {
    ...base,
    x: base.x + dx,
    y: base.y + dy,
    kind,
    tampered: true,
    confidence: Math.max(0, base.confidence * 0.7),
  };
}
