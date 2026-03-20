// shared/tombstoneApi.js
// Remote tombstone worker API – captures character creation and death telemetry.
// Calls are fire-and-forget; callers should .catch() any errors they wish to log.

const TOMBSTONE_ENDPOINT = "https://tombstone.jensen-petej.workers.dev";
/** @type {Array<{playerName: string, score: number, className: string, depth?: number}>|null} */
let _cachedHighscores = null;

function safeVersionText(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || null;
}

function finiteInt(value) {
  return Number.isFinite(value) ? Math.trunc(value) : null;
}

/**
 * Parses version text by stripping all non-digit characters.
 * @param {unknown} value
 * @returns {number|null}
 */
export function parseVersionNumber(value) {
  const text = safeVersionText(value);
  if (!text) return null;
  const digitsOnly = text.replace(/\D+/g, '');
  if (!digitsOnly) return null;
  const parsed = Number.parseInt(digitsOnly, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * @returns {{ versionText: string|null, versionNumber: number|null }}
 */
export function getRuntimeVersionMeta() {
  const versionText = safeVersionText((/** @type {any} */ (globalThis)).VERSION);
  const versionNumber = parseVersionNumber(versionText);
  return { versionText, versionNumber };
}

/**
 * @param {any} entry
 * @returns {{ versionText: string|null, versionNumber: number|null }}
 */
export function getHighscoreVersionMeta(entry) {
  const versionText = safeVersionText(entry?.versionText ?? entry?.version_text ?? entry?.version);
  const versionNumber = finiteInt(entry?.versionNumber ?? entry?.version_number ?? entry?.version) ?? parseVersionNumber(versionText);
  return { versionText, versionNumber };
}

/**
 * @param {any} entry
 * @returns {string}
 */
export function getHighscoreVersionLabel(entry) {
  const { versionText, versionNumber } = getHighscoreVersionMeta(entry);
  if (versionText) return `v${versionText}`;
  if (versionNumber != null) return `v${versionNumber}`;
  return 'v?';
}

/**
 * @param {any[]} scores
 * @returns {any[]}
 */
export function sortHighscores(scores) {
  if (!Array.isArray(scores)) return [];
  return [...scores].sort((a, b) => {
    const av = getHighscoreVersionMeta(a).versionNumber ?? -1;
    const bv = getHighscoreVersionMeta(b).versionNumber ?? -1;
    if (bv !== av) return bv - av;
    const as = Math.max(0, Number(a?.score || 0) | 0);
    const bs = Math.max(0, Number(b?.score || 0) | 0);
    if (bs !== as) return bs - as;
    const ad = Math.max(0, Number(a?.depth || 0) | 0);
    const bd = Math.max(0, Number(b?.depth || 0) | 0);
    if (bd !== ad) return bd - ad;
    const at = Math.max(0, Number(a?.turns || 0) | 0);
    const bt = Math.max(0, Number(b?.turns || 0) | 0);
    if (at !== bt) return at - bt;
    const acRaw = a?.createdAt ?? a?.created_at ?? 0;
    const bcRaw = b?.createdAt ?? b?.created_at ?? 0;
    const ac = Math.max(0, Number(acRaw || 0) | 0);
    const bc = Math.max(0, Number(bcRaw || 0) | 0);
    return ac - bc;
  });
}

/**
 * @returns {Array<{playerName: string, score: number, className: string, depth?: number}>|null}
 */
export function getCachedHighscores() {
  return Array.isArray(_cachedHighscores) ? _cachedHighscores.slice() : null;
}

/**
 * @param {string} path - Endpoint path (e.g. "/tombstone" or "/created")
 * @param {object} payload - JSON-serialisable payload
 * @returns {Promise<void>}
 */
async function postToWorker(path, payload) {
  const url = `${TOMBSTONE_ENDPOINT}${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  });

  // Non-2xx responses are silently ignored — telemetry must never break gameplay.
}

/**
 * POST a player death tombstone to the remote worker.
 * @param {object} tombstone - Any JSON-serialisable death record.
 * @returns {Promise<void>}
 */
export function postDeathTombstone(tombstone) {
  return postToWorker("/tombstone", tombstone);
}

/**
 * POST a character-created event to the remote worker.
 * @param {object} created - Any JSON-serialisable creation record.
 * @returns {Promise<void>}
 */
export function postCharacterCreated(created) {
  return postToWorker("/created", created);
}

/**
 * Fetch the global highscores leaderboard.
 * @returns {Promise<Array<{playerName: string, score: number, className: string}>|null>}
 */
export async function getHighscores() {
  try {
    const res = await fetch(`${TOMBSTONE_ENDPOINT}/highscores`);
    if (!res.ok) return null;
    const data = await res.json();
    const scores = Array.isArray(data?.highscores) ? sortHighscores(data.highscores) : null;
    _cachedHighscores = Array.isArray(scores) ? scores.slice() : null;
    return scores;
  } catch {
    return null;
  }
}
