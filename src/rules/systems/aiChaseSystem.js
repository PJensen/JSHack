// src/rules/systems/aiChaseSystem.js
// Very simple AI: monsters attempt to step toward the player each tick.
// Ranged enemies (with Equipment.ranged + ammo) shoot when in range and LOS.

import { Position } from "../components/Position.js";
import { Faction } from "../components/Faction.js";
import { Speed } from "../components/Speed.js";
import { Player } from "../components/Player.js";
import { Equipment } from "../components/Equipment.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { MoveIntent } from "../components/Intents/MoveIntent.js";
import { RangedAttackIntent } from "../components/Intents/RangedAttackIntent.js";
import { forEachInRadius } from "../utils/spatialIndex.js";
import { statusStrength } from "../utils/statusFacade.js";
import { hasLOS } from "../../shared/math/gridLOS.js";
import { buildBlocksVisionMap, blockedCallback } from "../utils/vision.js";

const ACTIVE_RADIUS = 32; // tiles; keep AI work bounded to nearby entities

export function aiChaseSystem(world) {
  // Identify the player position and entity ID (first found)
  let playerId = 0;
  let playerPos = null;
  for (const [id, _p, pos] of world.query(Player, Position)) {
    playerId = id;
    playerPos = { x: pos.x, y: pos.y };
    break;
  }
  if (!playerPos) return;

  // Lazily built blocking map for LOS checks (only when a ranged enemy needs it)
  let _isBlocked = null;

  // For each enemy-faction entity, add a MoveIntent toward player if none queued
  forEachInRadius(world, playerPos.x, playerPos.y, ACTIVE_RADIUS, (id, pos) => {
    const fac = world.get(id, Faction);
    if (!fac || fac.key !== 'enemy') return;

    // Speed gate: only act on ticks that match this entity's cadence
    const spd = world.get(id, Speed);
    let actEvery = (spd && spd.actEvery > 1) ? spd.actEvery : 1;

    // Frost slow: layer on top of base Speed — each stack doubles the cadence
    // 1 stack → act half as often, 2 → third, 3 → quarter
    const frostStacks = Math.min(3, statusStrength(world, id, "frozen"));
    if (frostStacks > 0) {
      actEvery = actEvery * (1 + frostStacks);
    }

    if (actEvery > 1 && ((world.step + id) % actEvery) !== 0) return;

    // If already has a MoveIntent (e.g., set externally), skip
    if (world.has(id, MoveIntent)) return;

    const dxp = playerPos.x - pos.x;
    const dyp = playerPos.y - pos.y;

    // Ranged attack: if equipped with a bow and ammo, prefer shooting over chasing
    const eq = world.get(id, Equipment);
    if (eq && eq.ranged && eq.ammo && world.isAlive(eq.ammo)) {
      const weaponInfo = eq.ranged ? world.get(eq.ranged, ItemInfo) : null;
      const maxRange = weaponInfo?.range || 8;
      const dist = Math.max(Math.abs(dxp), Math.abs(dyp));
      if (dist > 1 && dist <= maxRange) {
        if (!_isBlocked) _isBlocked = blockedCallback(buildBlocksVisionMap(world));
        if (hasLOS(pos.x | 0, pos.y | 0, playerPos.x | 0, playerPos.y | 0, _isBlocked)) {
          try { world.add(id, RangedAttackIntent, { targetId: playerId }); } catch {}
          return;
        }
      }
    }

    const dx0 = Math.sign(dxp) | 0;
    const dy0 = Math.sign(dyp) | 0;

    // Prefer axis with bigger distance; fallback to the other axis
    const ax = Math.abs(dxp);
    const ay = Math.abs(dyp);
    let dx = 0, dy = 0;
    if (ax >= ay) { dx = dx0; dy = 0; } else { dy = dy0; dx = 0; }

    // If both zero (same tile), do nothing
    if ((dx | dy) === 0) return;

    try { world.add(id, MoveIntent, { dx, dy }); } catch {} // ECS: may already exist
  });
}
