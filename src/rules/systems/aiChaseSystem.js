// src/rules/systems/aiChaseSystem.js
// Very simple AI: monsters attempt to step toward the player each tick.

import { Position } from "../components/Position.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Player } from "../components/Player.js";
import { MoveIntent } from "../components/Intents/MoveIntent.js";

export function aiChaseSystem(world) {
  // Identify the player position (first found)
  let playerPos = null;
  for (const [id, pos] of world.query(Position)) {
    if (world.has(id, Player)) { playerPos = { x: pos.x, y: pos.y }; break; }
  }
  if (!playerPos) return;

  // For each monster (identity === 'monster'), add a MoveIntent toward player if none queued
  for (const [id, pos] of world.query(Position)) {
    const ident = world.get(id, NamedIdentity);
    if (!ident || ident.identity !== 'monster') continue;

    // If already has a MoveIntent (e.g., set externally), skip
    if (world.has(id, MoveIntent)) continue;

    const vx = playerPos.x - pos.x;
    const vy = playerPos.y - pos.y;
    const mag = Math.hypot(vx, vy);
    if (mag <= 1e-4) continue;

    try { world.add(id, MoveIntent, { dx: vx, dy: vy }); } catch {}
  }
}
