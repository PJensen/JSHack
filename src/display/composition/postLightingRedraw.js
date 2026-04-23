const OVERWORLD_POST_LIGHTING_REDRAW_KINDS = new Set([
  "mountain",
  "mountain_b",
  "mountain_c",
  "tree",
  "door_closed",
  "door_open",
  "stair_down",
  "stair_up",
]);

export function shouldPostLightingRedrawKind(palette, kind, opts = {}) {
  if (!opts?.isOverworld) return false;
  if (typeof kind !== "string" || kind.length === 0) return false;
  if (!OVERWORLD_POST_LIGHTING_REDRAW_KINDS.has(kind)) return false;

  const look = palette?.[kind];
  if (!look || Array.isArray(look.layers) || !look.bg) return false;

  return true;
}
