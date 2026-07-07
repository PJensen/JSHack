import { buildPalette } from "../../display/palette/index.js";

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

export function statusDisplayMetadata(key) {
  return STATUS_DISPLAY[String(key || "").toLowerCase()] || null;
}

export function enrichStatusRowDisplay(row) {
  if (!row || typeof row !== "object") return row;
  const meta = statusDisplayMetadata(row.key);
  return meta ? { ...row, ...meta } : row;
}
