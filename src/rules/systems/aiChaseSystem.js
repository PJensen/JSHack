// src/rules/systems/aiChaseSystem.js
// Very simple AI: monsters attempt to step toward the player each tick.

import { Position } from "../components/Position.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Player } from "../components/Player.js";
import { MoveIntent } from "../components/Intents/MoveIntent.js";

function chooseChaseStep(dx, dy) {
  const vx = Number.isFinite(dx) ? dx : 0;
  const vy = Number.isFinite(dy) ? dy : 0;
  if (vx === 0 && vy === 0) return { x: 0, y: 0 };
  const mag = Math.hypot(vx, vy);
  if (mag <= 1e-6) {
    return { x: Math.sign(vx), y: Math.sign(vy) };
  }
  let stepX = Math.round(vx / mag);
  let stepY = Math.round(vy / mag);
  if (stepX === 0 && vx !== 0) stepX = Math.sign(vx);
  if (stepY === 0 && vy !== 0) stepY = Math.sign(vy);
  const clamp = (v) => (v > 0 ? 1 : v < 0 ? -1 : 0);
  return { x: clamp(stepX), y: clamp(stepY) };
}

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

    const step = chooseChaseStep(dx, dy);
    if (step.x === 0 && step.y === 0) continue;

    try { world.add(id, MoveIntent, { dx: step.x, dy: step.y }); } catch {}
  }
}
