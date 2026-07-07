import { buildPalette } from "../../display/palette/index.js";
import { EFFECT_DEFS } from "../../rules/data/effectDefs.js";

const _palette = buildPalette();

function hexToHue(value, fallback = 210) {
  const hex = String(value || "").trim().replace(/^#/, "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return fallback;
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return fallback;
  let h = 0;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = ((b - r) / d) + 2;
  else h = ((r - g) / d) + 4;
  return Math.round((h * 60 + 360) % 360);
}

const FOOD_STEW_VIS = (() => {
  const p = _palette.food_stew || {};
  return Object.freeze({
    name: "Town Stew",
    glyph: String(p.glyph || "%"),
    glyphColor: String(p.fg || "#c88a4a"),
    glowColor: String(p.glow || "#8a5a2a"),
    hue: hexToHue(p.glow || p.fg, 30),
  });
})();

const STATUS_DISPLAY = Object.freeze({
  town_stew: FOOD_STEW_VIS,
});

const EFFECT_META_BY_KEY = (() => {
  const map = new Map();
  for (let i = 0; i < EFFECT_DEFS.length; i++) {
    const def = EFFECT_DEFS[i];
    const keys = []
      .concat(Array.isArray(def?.keys) ? def.keys : [])
      .concat(Array.isArray(def?.statuses) ? def.statuses : []);
    for (let k = 0; k < keys.length; k++) {
      const key = String(keys[k] || "").trim().toLowerCase();
      if (!key || map.has(key)) continue;
      map.set(key, def);
    }
  }
  return map;
})();

function effectDefForKey(key) {
  return EFFECT_META_BY_KEY.get(String(key || "").trim().toLowerCase()) || null;
}

function humanizeKey(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function operationLine(operation, potency) {
  const amount = Math.max(0, Number(potency || 0));
  const suffix = amount > 0 ? ` ${amount}/turn` : "";
  switch (String(operation || "none")) {
    case "damage": return `Deals damage${suffix}.`;
    case "heal": return `Restores HP${suffix}.`;
    case "stamina_restore": return `Restores stamina${suffix}.`;
    case "mana_restore": return `Restores mana${suffix}.`;
    case "none": return "";
    default: return humanizeKey(operation);
  }
}

function effectDetailData(row) {
  const def = effectDefForKey(row?.key);
  const turns = Math.max(0, Number(row?.turns || 0) | 0);
  const stacks = Math.max(1, Number(row?.stacks || 1) | 0);
  const potency = Number(row?.potency || 0);
  const detailLines = [];
  if (turns >= 9999) detailLines.push("Duration indefinite");
  else detailLines.push(`${turns} turns remaining`);
  if (stacks > 1) detailLines.push(`Stacks x${stacks}`);
  if (potency > 0) detailLines.push(`Potency ${potency}`);

  const operations = Array.isArray(def?.operations) && def.operations.length > 0
    ? def.operations
    : (def?.operation ? [def.operation] : []);
  const targetEffects = operations
    .map((op) => operationLine(op, potency))
    .filter(Boolean);

  const statusKeys = Array.isArray(def?.statuses) ? def.statuses : [];
  for (const status of statusKeys) {
    const statusKey = String(status || "").trim();
    if (!statusKey || statusKey === row?.key) continue;
    targetEffects.push(`Projects ${humanizeKey(statusKey)}.`);
  }

  return {
    description: String(def?.description || "").trim(),
    detailLines,
    targetEffects,
  };
}

export function statusDisplayMetadata(key) {
  return STATUS_DISPLAY[String(key || "").toLowerCase()] || null;
}

export function enrichStatusRowDisplay(row) {
  if (!row || typeof row !== "object") return row;
  const meta = statusDisplayMetadata(row.key);
  const details = effectDetailData(row);
  return meta ? { ...row, ...meta, ...details } : { ...row, ...details };
}
