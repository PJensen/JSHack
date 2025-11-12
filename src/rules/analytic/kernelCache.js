const DEFAULT_TTL = 6;

export class KernelCache {
  constructor(size = 4) {
    this.size = size;
    this.map = new Map();
    this.clock = 0;
    this.hits = 0;
    this.misses = 0;
  }

  get(floorId) {
    const entry = this.map.get(floorId);
    if (entry && entry.kernel) {
      this.hits += 1;
      entry.lastUsed = ++this.clock;
      return entry.kernel;
    }
    this.misses += 1;
    return null;
  }

  put(floorId, kernel) {
    let entry = this.map.get(floorId);
    if (!entry) {
      entry = { kernel: null, lastUsed: 0, hotUntil: 0 };
      this.map.set(floorId, entry);
    }
    entry.kernel = kernel;
    entry.lastUsed = ++this.clock;
    if (!entry.hotUntil) {
      entry.hotUntil = 0;
    }
    this.trim();
  }

  markHot(floorId, ttl = DEFAULT_TTL) {
    const entry = this.map.get(floorId);
    const until = this.clock + ttl;
    if (entry) {
      entry.hotUntil = Math.max(entry.hotUntil ?? 0, until);
    } else {
      this.map.set(floorId, { kernel: null, lastUsed: ++this.clock, hotUntil: until });
      this.trim();
    }
  }

  evictLRU() {
    let candidate = null;
    let candidateId = null;
    for (const [floorId, entry] of this.map.entries()) {
      if (entry.hotUntil && entry.hotUntil > this.clock) {
        continue;
      }
      if (!candidate || entry.lastUsed < candidate.lastUsed) {
        candidate = entry;
        candidateId = floorId;
      }
    }
    if (!candidateId) {
      for (const [floorId, entry] of this.map.entries()) {
        if (!candidate || entry.lastUsed < candidate.lastUsed) {
          candidate = entry;
          candidateId = floorId;
        }
      }
    }
    if (candidateId != null) {
      this.map.delete(candidateId);
    }
  }

  trim() {
    while (this.map.size > this.size) {
      this.evictLRU();
    }
  }

  hitRate() {
    const total = this.hits + this.misses;
    return total === 0 ? 1 : this.hits / total;
  }
}

export const __doc__ = {
  purpose: "LRU kernel cache for analytic dungeon kernels",
  stability: "beta",
  author: "CODEX",
  version: "2025.11.11",
  notes: [
    "Maintains small hot set of analytic kernels keyed by floor id.",
    "markHot keeps recently used kernels resident for deterministic traversal.",
    "hitRate enables regression checks on cache performance.",
  ],
};
