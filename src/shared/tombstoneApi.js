// shared/tombstoneApi.js
// Remote tombstone worker API – captures character creation and death telemetry.
// Calls are fire-and-forget; callers should .catch() any errors they wish to log.

const TOMBSTONE_ENDPOINT = "https://tombstone.jensen-petej.workers.dev";
/** @type {Array<{playerName: string, score: number, className: string, depth?: number}>|null} */
let _cachedHighscores = null;

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
    const scores = Array.isArray(data?.highscores) ? data.highscores : null;
    _cachedHighscores = Array.isArray(scores) ? scores.slice() : null;
    return scores;
  } catch {
    return null;
  }
}
