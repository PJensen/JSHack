// Deterministic skip-list keyed by (dueTurn, key) for turn-based wakeups.
// No Math.random() usage: node level is derived from a stable key hash.

function hash32(text) {
  let h = 0x811c9dc5;
  const s = String(text || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function cmp(turnA, keyA, turnB, keyB) {
  if (turnA !== turnB) return turnA - turnB;
  if (keyA < keyB) return -1;
  if (keyA > keyB) return 1;
  return 0;
}

class Node {
  constructor(level, turn, key, value) {
    this.turn = turn | 0;
    this.key = String(key);
    this.value = value;
    this.forward = new Array(level).fill(null);
  }
}

export function createTurnSchedule({ maxLevel = 12 } = {}) {
  const max = Math.max(2, Number(maxLevel) | 0);
  const head = new Node(max, Number.MIN_SAFE_INTEGER, "__head__", null);
  let level = 1;
  let size = 0;
  /** @type {Map<string, { turn:number, value:any }>} */
  const byKey = new Map();

  function levelForKey(key) {
    let lvl = 1;
    let h = hash32(key);
    while (lvl < max && (h & 1) === 1) {
      lvl++;
      h >>>= 1;
      if (h === 0) h = hash32(`${key}:${lvl}`);
    }
    return lvl;
  }

  function findUpdate(turn, key) {
    const update = new Array(max).fill(head);
    let current = head;
    for (let i = level - 1; i >= 0; i--) {
      while (current.forward[i] && cmp(current.forward[i].turn, current.forward[i].key, turn, key) < 0) {
        current = current.forward[i];
      }
      update[i] = current;
    }
    return update;
  }

  function removeExact(turn, key) {
    const update = findUpdate(turn, key);
    const node = update[0].forward[0];
    if (!node || cmp(node.turn, node.key, turn, key) !== 0) return false;
    for (let i = 0; i < level; i++) {
      if (update[i].forward[i] !== node) break;
      update[i].forward[i] = node.forward[i];
    }
    while (level > 1 && !head.forward[level - 1]) level--;
    size = Math.max(0, size - 1);
    return true;
  }

  function schedule(key, dueTurn, value = null) {
    const k = String(key);
    const turn = Number(dueTurn) | 0;
    const prev = byKey.get(k);
    if (prev) removeExact(prev.turn | 0, k);

    const update = findUpdate(turn, k);
    const nodeLevel = levelForKey(k);
    if (nodeLevel > level) {
      for (let i = level; i < nodeLevel; i++) update[i] = head;
      level = nodeLevel;
    }

    const node = new Node(nodeLevel, turn, k, value);
    for (let i = 0; i < nodeLevel; i++) {
      node.forward[i] = update[i].forward[i];
      update[i].forward[i] = node;
    }

    byKey.set(k, { turn, value });
    size++;
  }

  function cancel(key) {
    const k = String(key);
    const prev = byKey.get(k);
    if (!prev) return false;
    const removed = removeExact(prev.turn | 0, k);
    byKey.delete(k);
    return removed;
  }

  function has(key) {
    return byKey.has(String(key));
  }

  function getDueTurn(key) {
    const rec = byKey.get(String(key));
    return rec ? (rec.turn | 0) : null;
  }

  function peek() {
    const node = head.forward[0];
    if (!node) return null;
    return { key: node.key, dueTurn: node.turn | 0, value: node.value };
  }

  function popFirst() {
    const node = head.forward[0];
    if (!node) return null;
    const k = node.key;
    const turn = node.turn | 0;
    removeExact(turn, k);
    byKey.delete(k);
    return { key: k, dueTurn: turn, value: node.value };
  }

  function drainDue(nowTurn, onDue) {
    const now = Number(nowTurn) | 0;
    while (true) {
      const next = peek();
      if (!next || (next.dueTurn | 0) > now) break;
      const due = popFirst();
      if (!due) break;
      if (typeof onDue === "function") onDue(due.key, due.value, due.dueTurn);
    }
  }

  function clear() {
    for (let i = 0; i < max; i++) head.forward[i] = null;
    byKey.clear();
    level = 1;
    size = 0;
  }

  return Object.freeze({
    schedule,
    cancel,
    has,
    getDueTurn,
    peek,
    popFirst,
    drainDue,
    clear,
    get size() { return size; },
  });
}
