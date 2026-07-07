export const DEFAULT_AI_ENDPOINT = "http://10.0.0.69:8080/v1/chat/completions";

const LS_AI_ENABLED = "jshack:ai:enabled";
const LS_AI_ENDPOINT = "jshack:ai:endpoint";
const LS_AI_API_KEY = "jshack:ai:apiKey";
const LS_AI_MODEL = "jshack:ai:model";

function lsGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function lsSet(key, value) {
  try { localStorage.setItem(key, String(value)); } catch {}
}

function cleanText(value) {
  return String(value ?? "").trim();
}

export function readAISettings() {
  const endpoint = cleanText(lsGet(LS_AI_ENDPOINT)) || DEFAULT_AI_ENDPOINT;
  const model = cleanText(lsGet(LS_AI_MODEL));
  return {
    enabled: lsGet(LS_AI_ENABLED) === "true",
    endpoint,
    apiKey: cleanText(lsGet(LS_AI_API_KEY)),
    model,
  };
}

export function writeAISettings(patch = {}) {
  if (Object.prototype.hasOwnProperty.call(patch, "enabled")) {
    lsSet(LS_AI_ENABLED, patch.enabled === true ? "true" : "false");
  }
  if (Object.prototype.hasOwnProperty.call(patch, "endpoint")) {
    lsSet(LS_AI_ENDPOINT, cleanText(patch.endpoint) || DEFAULT_AI_ENDPOINT);
  }
  if (Object.prototype.hasOwnProperty.call(patch, "apiKey")) {
    lsSet(LS_AI_API_KEY, cleanText(patch.apiKey));
  }
  if (Object.prototype.hasOwnProperty.call(patch, "model")) {
    lsSet(LS_AI_MODEL, cleanText(patch.model));
  }
  return readAISettings();
}
