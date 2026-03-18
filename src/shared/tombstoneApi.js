// shared/tombstoneApi.js
// Remote tombstone worker API – captures character creation and death telemetry.
// Calls are fire-and-forget; callers should .catch() any errors they wish to log.

const TOMBSTONE_ENDPOINT = "https://tombstone.jensen-petej.workers.dev";

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

  if (!res.ok) {
    throw new Error(`POST ${url} failed: ${res.status} ${res.statusText}`);
  }
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
