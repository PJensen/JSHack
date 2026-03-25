/**
 * ExploredFloorRepository - in-memory storage for per-depth explored fog state.
 * Encapsulates explored snapshot management for floor transitions and memory effects.
 */
export class ExploredFloorRepository {
  constructor() {
    /** @type {Map<number, Map<string, Uint8Array>>} */
    this._byDepth = new Map();
  }

  /** @param {number} depth @param {Map<string, Uint8Array>} snapshot @returns {boolean} */
  setSnapshot(depth, snapshot) {
    const d = Number(depth) | 0;
    if (d <= 0 || !(snapshot instanceof Map)) return false;
    this._byDepth.set(d, snapshot);
    return true;
  }

  /** @param {number} depth @returns {Map<string, Uint8Array>|undefined} */
  getSnapshot(depth) {
    return this._byDepth.get(Number(depth) | 0);
  }

  /** @returns {number[]} */
  listDepths() {
    return [...this._byDepth.keys()];
  }

  /** @param {number} depth */
  deleteDepth(depth) {
    this._byDepth.delete(Number(depth) | 0);
  }

  clear() {
    this._byDepth.clear();
  }
}
