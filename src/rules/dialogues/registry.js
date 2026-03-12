const DIALOG_DEFS = new Map();

export function registerDialog(def) {
  if (!def || typeof def !== "object") throw new Error("registerDialog: dialog def must be an object");
  if (!def.id) throw new Error("registerDialog: dialog def requires an id");
  DIALOG_DEFS.set(String(def.id), def);
  return def;
}

export function getDialog(id) {
  return DIALOG_DEFS.get(String(id || "")) || null;
}

export function clearDialogRegistry() {
  DIALOG_DEFS.clear();
}
