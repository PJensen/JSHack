/**
 * @typedef {{ role: string, content: string }} ChatMessage
 */

function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .map((message) => ({
      role: String(message?.role || "").trim(),
      content: String(message?.content || "").trim(),
    }))
    .filter((message) => message.role && message.content);
}

function finiteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Calls an OpenAI-compatible /v1/chat/completions endpoint.
 *
 * This is optional cloud infrastructure. Failures return null so gameplay can
 * continue without AI.
 *
 * @param {{
 *   endpoint: string,
 *   apiKey?: string,
 *   model: string,
 *   messages: ChatMessage[],
 *   temperature?: number,
 *   maxTokens?: number,
 *   fetchImpl?: typeof fetch,
 * }} opts
 * @returns {Promise<string|null>}
 */
export async function completeOpenAICompatibleChat(opts = {}) {
  const endpoint = String(opts.endpoint || "").trim();
  const model = String(opts.model || "").trim();
  const messages = cleanMessages(opts.messages);
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  if (!endpoint || !model || !messages.length || typeof fetchImpl !== "function") return null;

  /** @type {Record<string, any>} */
  const body = { model, messages };
  const temperature = finiteNumber(opts.temperature);
  if (temperature !== null) body.temperature = temperature;
  const maxTokens = finiteNumber(opts.maxTokens);
  if (maxTokens !== null) body.max_tokens = Math.max(1, maxTokens | 0);

  /** @type {Record<string, string>} */
  const headers = { "Content-Type": "application/json" };
  const apiKey = String(opts.apiKey || "").trim();
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  try {
    const res = await fetchImpl(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!res?.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    const text = String(content || "").trim();
    return text || null;
  } catch {
    return null;
  }
}
