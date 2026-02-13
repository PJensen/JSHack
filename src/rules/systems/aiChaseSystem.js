// src/rules/systems/aiChaseSystem.js
// Very simple AI: monsters attempt to step toward the player each tick.

import { Position } from "../components/Position.js";
import { Faction } from "../components/Faction.js";
import { Speed } from "../components/Speed.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { Player } from "../components/Player.js";
import { MoveIntent } from "../components/Intents/MoveIntent.js";
import { forEachInRadius } from "../utils/spatialIndex.js";

const ACTIVE_RADIUS = 32; // tiles; keep AI work bounded to nearby entities

export function aiChaseSystem(world) {
  // Identify the player position (first found)
  let playerPos = null;
  for (const [id, _p, pos] of world.query(Player, Position)) {
    playerPos = { x: pos.x, y: pos.y };
    break;
  }
  if (!playerPos) return;

  // For each enemy-faction entity, add a MoveIntent toward player if none queued
  forEachInRadius(world, playerPos.x, playerPos.y, ACTIVE_RADIUS, (id, pos) => {
    const fac = world.get(id, Faction);
    if (!fac || fac.key !== 'enemy') return;

    // Speed gate: only act on ticks that match this entity's cadence
    const spd = world.get(id, Speed);
    let actEvery = (spd && spd.actEvery > 1) ? spd.actEvery : 1;

    // Frost slow: layer on top of base Speed — each stack doubles the cadence
    // 1 stack → act half as often, 2 → third, 3 → quarter
    const ae = world.get(id, ActiveEffects);
    if (ae && Array.isArray(ae.effects)) {
      const frost = ae.effects.find(/** @param {any} e */ (e) => e.key === 'frost');
      if (frost) {
        const stacks = Math.min(frost.stacks || 1, 3);
        actEvery = actEvery * (1 + stacks);
      }
    }

    if (actEvery > 1 && ((world.step + id) % actEvery) !== 0) return;

    // If already has a MoveIntent (e.g., set externally), skip
    if (world.has(id, MoveIntent)) return;

    const dxp = playerPos.x - pos.x;
    const dyp = playerPos.y - pos.y;
    const dx0 = Math.sign(dxp) | 0;
    const dy0 = Math.sign(dyp) | 0;

    // Prefer axis with bigger distance; fallback to the other axis
    const ax = Math.abs(dxp);
    const ay = Math.abs(dyp);
    let dx = 0, dy = 0;
    if (ax >= ay) { dx = dx0; dy = 0; } else { dy = dy0; dx = 0; }

    // If both zero (same tile), do nothing
    if ((dx | dy) === 0) return;

    try { world.add(id, MoveIntent, { dx, dy }); } catch {}
  });
}
