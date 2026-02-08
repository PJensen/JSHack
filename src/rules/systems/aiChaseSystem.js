// src/rules/systems/aiChaseSystem.js
// Very simple AI: monsters attempt to step toward the player each tick.

import { Position } from "../components/Position.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Player } from "../components/Player.js";
import { MoveIntent } from "../components/Intents/MoveIntent.js";

const ACTIVE_RADIUS = 32; // tiles; keep AI work bounded to nearby entities

export function aiChaseSystem(world) {
  // Identify the player position (first found)
  let playerPos = null;
  for (const [id, pos] of world.query(Position)) {
    if (world.has(id, Player)) { playerPos = { x: pos.x, y: pos.y }; break; }
  }
  if (!playerPos) return;

  // For each monster (identity === 'monster'), add a MoveIntent toward player if none queued
  for (const [id, pos, ident] of world.query(Position, NamedIdentity)) {
    if (!ident || ident.identity !== 'monster') continue;

    // If already has a MoveIntent (e.g., set externally), skip
    if (world.has(id, MoveIntent)) continue;

    const dxp = playerPos.x - pos.x;
    const dyp = playerPos.y - pos.y;
    if (Math.max(Math.abs(dxp), Math.abs(dyp)) > ACTIVE_RADIUS) continue;

    const dx0 = Math.sign(dxp) | 0;
    const dy0 = Math.sign(dyp) | 0;

    // Prefer axis with bigger distance; fallback to the other axis
    const ax = Math.abs(dxp);
    const ay = Math.abs(dyp);
    let dx = 0, dy = 0;
    if (ax >= ay) { dx = dx0; dy = 0; } else { dy = dy0; dx = 0; }

    // If both zero (same tile), do nothing
    if ((dx | dy) === 0) continue;

    try { world.add(id, MoveIntent, { dx, dy }); } catch {}
  }
}
