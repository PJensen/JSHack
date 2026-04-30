// Display-layer message template registry.
// Rules emit semantic events; this registry turns event context into prose.

/** @type {Map<string, Function|object>} */
const MESSAGE_TEMPLATES = new Map();

/**
 * @param {string} eventKey
 * @param {Function|{actor?: Function, target?: Function, witness?: Function}} template
 */
export function defineMessage(eventKey, template) {
  const key = String(eventKey || "").trim();
  if (!key) throw new Error("[defineMessage] eventKey is required");
  if (!template) throw new Error(`[defineMessage "${key}"] template is required`);
  MESSAGE_TEMPLATES.set(key, template);
}

/**
 * @param {string} eventKey
 * @returns {Function|object|null}
 */
export function getMessage(eventKey) {
  return MESSAGE_TEMPLATES.get(String(eventKey || "").trim()) || null;
}

/**
 * @param {string} eventKey
 * @param {object} ctx
 * @returns {{ text: string, type: string }|null}
 */
export function renderMessage(eventKey, ctx = {}) {
  const template = getMessage(eventKey);
  if (!template) return null;

  if (typeof template === "function") return normalizeResult(template(ctx));

  const actorName = String(ctx.actorName || ctx.actor || "");
  const targetName = String(ctx.targetName || ctx.target || "");
  const perspective = targetName === "You"
    ? "target"
    : actorName === "You"
      ? "actor"
      : "witness";
  const fn = template[perspective] || template.witness || template.actor || template.target;
  return typeof fn === "function" ? normalizeResult(fn(ctx)) : null;
}

/**
 * @param {any} result
 * @returns {{ text: string, type: string }|null}
 */
function normalizeResult(result) {
  if (typeof result === "string") return result ? { text: result, type: "default" } : null;
  if (!result || typeof result !== "object") return null;
  const text = String(result.text || "");
  if (!text) return null;
  return { text, type: String(result.type || "default") };
}

export function clearMessageRegistryForTests() {
  MESSAGE_TEMPLATES.clear();
}
