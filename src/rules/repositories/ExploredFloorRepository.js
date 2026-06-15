/**
 * ExploredFloorRepository - in-memory storage for per-depth explored fog state.
 * Encapsulates explored snapshot management for floor transitions and memory effects.
 */
export class ExploredFloorRepository {
  constructor() {
    /** @type {Map<string, Map<string, Uint8Array>>} */
    this._byDepth = new Map();
  }

  /** @param {number|string} depth @param {Map<string, Uint8Array>} snapshot @returns {boolean} */
  setSnapshot(depth, snapshot) {
    const key = this._key(depth);
    if (!key || !(snapshot instanceof Map)) return false;
    this._byDepth.set(key, snapshot);
    return true;
  }

  /** @param {number|string} depth @returns {Map<string, Uint8Array>|undefined} */
  getSnapshot(depth) {
    const key = this._key(depth);
    const exact = this._byDepth.get(key);
    if (exact || typeof depth === "string") return exact;
    const d = Number(depth) | 0;
    for (const [candidate, snap] of this._byDepth) {
      if (candidate === String(d) || candidate.startsWith(`z${d}:`)) return snap;
    }
    return undefined;
  }

  /** @returns {Array<number|string>} */
  listDepths() {
    return [...this._byDepth.keys()].map((key) => {
      const n = Number(key);
      return Number.isFinite(n) && String(n | 0) === key ? (n | 0) : key;
    });
  }

  /** @param {number|string} depth */
  deleteDepth(depth) {
    this._byDepth.delete(this._key(depth));
  }

  clear() {
    this._byDepth.clear();
  }

  /** @param {number|string} depth */
  _key(depth) {
    if (typeof depth === "string") return depth;
    const d = Number(depth) | 0;
    return d > 0 ? String(d) : "";
  }
}
