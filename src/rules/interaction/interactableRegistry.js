const AUTHORED_INTERACTABLES = new Map();

export function registerAuthoredInteractable(action, definition) {
  const key = String(action || "");
  if (!key) throw new Error("registerAuthoredInteractable: action is required");
  if (!definition || typeof definition !== "object") {
    throw new Error(`registerAuthoredInteractable: invalid definition for "${key}"`);
  }
  const current = AUTHORED_INTERACTABLES.get(key);
  if (current === definition) return;
  if (current) throw new Error(`registerAuthoredInteractable: duplicate action "${key}"`);
  AUTHORED_INTERACTABLES.set(key, definition);
}

export function getAuthoredInteractable(action) {
  return AUTHORED_INTERACTABLES.get(String(action || "")) || null;
}

export function listAuthoredInteractables() {
  return Array.from(AUTHORED_INTERACTABLES.entries());
}
