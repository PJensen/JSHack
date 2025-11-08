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

    const dx = Math.round(playerPos.x) - Math.round(pos.x);
    const dy = Math.round(playerPos.y) - Math.round(pos.y);
    if (dx === 0 && dy === 0) continue;

    let stepX = 0;
    let stepY = 0;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX > absY) stepX = Math.sign(dx);
    else if (absY > absX) stepY = Math.sign(dy);
    else if (absX > 0) stepX = Math.sign(dx);
    else stepY = Math.sign(dy);

    if (stepX === 0 && stepY === 0) continue;

    try { world.add(id, MoveIntent, { dx: stepX, dy: stepY }); } catch {}
  }
}
