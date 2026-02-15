// src/rules/systems/movementSystem.js
// Consumes MoveIntent, applies grid-based movement with simple collision.

import { Position } from "../components/Position.js";
import { MoveIntent } from "../components/Intents/MoveIntent.js";
import { isWalkable, getTile, setTile, isLoaded } from "../environment/dungeon/tileMap.js";
import { TILE_VOID, TILE_WALL, TILE_FLOOR } from "../environment/dungeon/constants.js";
import { Equipment } from "../components/Equipment.js";
import { Stamina } from "../components/Stamina.js";
import { Interactable } from "../components/Interactable.js";
import { Inventory } from "../components/Inventory.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Settings } from "../components/Settings.js";
import { AttackIntent } from "../components/Intents/AttackIntent.js";
import { Faction } from "../components/Faction.js";
import { Player } from "../components/Player.js";
import { Facing } from "../components/Facing.js";
import { Status } from "../components/Status.js";
import { STAMINA_REGEN_COOLDOWN } from "../data/regenConstants.js";
import { getTileQuerySnapshot } from "../utils/tileQueryCache.js";
import { combatSeed, mulberry32 } from "../utils/rng.js";

/** @param {number} x @param {number} y */
function key(x, y) { return `${x},${y}`; }

const MISSTEP_DIRS = Object.freeze([
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],            [1, 0],
  [-1, 1],  [0, 1],   [1, 1],
]);

/**
 * @param {any} status
 * @param {string} type
 * @returns {number}
 */
function statusStrength(status, type) {
  if (!status || !Array.isArray(status.statuses)) return 0;
  let total = 0;
  for (const s of status.statuses) {
    if (!s || s.type !== type) continue;
    if (!Number.isInteger(s.duration) || s.duration <= 0) continue;
    const potency = Number.isFinite(s.potency) ? Number(s.potency) : 1;
    const stacks = Number.isInteger(s.stacks) && s.stacks > 0 ? s.stacks : 1;
    total += Math.max(1, Math.round(Math.max(0, potency) * stacks));
  }
  return total;
}

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function movementSystem(world) {
  const tiles = getTileQuerySnapshot(world);
  // Start from snapshot and reserve destinations as actors move this tick.
  const blocking = new Set(tiles.blockedByCell);
  const interactables = tiles.interactableByCell;
  const living = tiles.livingByCell;

  for (const [actor, intent] of world.query(MoveIntent)) {
    try {
      const pos = world.get(actor, Position);
      if (!pos) { world.remove(actor, MoveIntent); continue; }

      const intendedDx = intent.dx | 0;
      const intendedDy = intent.dy | 0;
      let mdx = intendedDx;
      let mdy = intendedDy;

      // Confusion: movement inputs become a deterministic random misstep.
      const confusePower = statusStrength(world.get(actor, Status), "confused");
      if (confusePower > 0 && (intendedDx !== 0 || intendedDy !== 0)) {
        const options = MISSTEP_DIRS.filter(([dx, dy]) => !(dx === intendedDx && dy === intendedDy));
        if (options.length > 0) {
          const posSalt = (((pos.x | 0) & 0xffff) << 16) ^ ((pos.y | 0) & 0xffff);
          const r = mulberry32(combatSeed(world.seed, world.step, actor, posSalt, 0xC0F00D11));
          const idx = (r() * options.length) | 0;
          [mdx, mdy] = options[idx];
          try {
            world.emit?.("status:confused-misstep", {
              actor,
              from: { dx: intendedDx, dy: intendedDy },
              to: { dx: mdx, dy: mdy },
            });
          } catch {}
        }
      }

      const nx = pos.x + mdx;
      const ny = pos.y + mdy;
      const k = key(nx, ny);

      // Record facing direction on every move attempt (successful or not)
      if (world.has(actor, Facing)) {
        world.set(actor, Facing, { dx: mdx, dy: mdy });
      }

      if (!isWalkable(nx, ny) || blocking.has(k)) {
        // Cheap bump-attack: prefer a living target with Vitality in the destination cell.
        const target = living.get(k) || 0;
        const manhattan = Math.abs(mdx) + Math.abs(mdy);
        if (manhattan === 1 && Number.isInteger(target) && target > 0 && target !== actor) {
          // Check faction: neutral/shopkeeper NPCs with Interactable trigger interaction, not attack
          const fac = world.get(target, Faction);
          if (fac && (fac.key === 'shopkeeper' || fac.key === 'neutral') && world.has(target, Interactable)) {
            // Emit bump-interact event for cross-system communication without direct coupling
            try { world.emit?.("bump:interact", { actor, target }); } catch {}
          } else {
            try { world.add(actor, AttackIntent, { targetId: target }); } catch {}
          }
        } else if (world.has(actor, Player)) {
          // No living target — try interactable (e.g., closed door, chest)
          // Only the player can bump-interact with objects; monsters just bounce off.
          // Emit bump-interact event for cross-system communication without direct coupling
          const targetId = interactables.get(k);
          if (targetId) {
            try { world.emit?.("bump:interact", { actor, target: targetId }); } catch {}
          } else if (getTile(nx, ny) === TILE_WALL) {
            // Dig: if the player has a pickaxe equipped (weapon with dig bonus), mine the wall.
            const eq = world.get(actor, Equipment);
            const weaponId = eq?.weapon || 0;
            if (weaponId) {
              const wInfo = world.get(weaponId, ItemInfo);
              if (wInfo?.bonuses?.dig) {
                const stam = world.get(actor, Stamina);
                const cost = Number(wInfo.staminaCost ?? 5);
                if (stam && (Number(stam.stamina ?? 0) >= cost)) {
                  world.set(actor, Stamina, { ...stam, stamina: stam.stamina - cost, regenCooldown: STAMINA_REGEN_COOLDOWN });
                  setTile(nx, ny, TILE_FLOOR);
                  // Backfill: turn any void neighbors into walls so we never expose void
                  for (const [dx, dy] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
                    if (isLoaded(nx+dx, ny+dy) && getTile(nx+dx, ny+dy) === TILE_VOID) {
                      setTile(nx+dx, ny+dy, TILE_WALL);
                    }
                  }
                  try { world.emit?.("tile:dug", { actor, x: nx, y: ny }); } catch {}
                } else {
                  try { world.emit?.("attack:insufficient-stamina", { attacker: actor, need: cost, have: Number(stam?.stamina ?? 0) }); } catch {}
                }
              }
            }
          }
        }
        // blocked: movement is consumed
      } else {
        const from = { x: pos.x, y: pos.y };
        world.set(actor, Position, { x: nx, y: ny });
        world.emit?.("moved", { id: actor, from, to: { x: nx, y: ny } });
        // Reserve the destination so subsequent movers in this tick can't step into the same tile
        blocking.add(k);

        // Immediate auto-pickup for actors with Settings.autoPickup (defaults true)
        // Focused on currency to avoid unexpected heavy pickups.
        const inv = world.get(actor, Inventory);
        const set = world.get(actor, Settings);
        const enable = (set?.autoPickup !== false);
        if (inv && enable) {
          const kinds = Array.isArray(set?.autoPickupKinds) && set.autoPickupKinds.length ? set.autoPickupKinds : ["currency"];
          const idsAtTile = tiles.itemsByCell.get(k);
          if (idsAtTile && idsAtTile.length > 0) {
            for (let i = 0; i < idsAtTile.length; i++) {
              const itemId = idsAtTile[i];
              if (!world.isAlive(itemId)) continue;
              const ipos = world.get(itemId, Position);
              if (!ipos || ipos.x !== nx || ipos.y !== ny) continue;
              const info = world.get(itemId, ItemInfo);
              if (!info || !info.type || !kinds.includes(info.type)) continue;
              const count = info.count || 1;
              const ident = world.get(itemId, NamedIdentity)?.identity;
              // find existing stack by identity
              let stackTarget = 0;
              for (const id of inv.items) {
                const n = world.get(id, NamedIdentity);
                if (n && n.identity === ident) { stackTarget = id; break; }
              }
              if (stackTarget) {
                world.mutate(stackTarget, ItemInfo, /** @param {any} r */ (r) => { r.count = (r.count || 1) + count; });
                world.destroy(itemId);
              } else {
                // capacity gate: allow if capacity not set or there's room
                // Special case: currency ignores capacity so monsters can hoard gold even with capacity 0
                const ignoreCapacity = info.type === 'currency';
                if (ignoreCapacity || inv.capacity == null || inv.items.length < inv.capacity) {
                  try { world.remove(itemId, Position); } catch {}
                  inv.items.push(itemId);
                } else {
                  // no capacity — skip silently for now
                }
              }
              try { world.emit && world.emit('item:pickup', { actor, itemId, count }); } catch {}
            }
          }
        }
      }
    } catch {}
    // Consume the intent regardless
    try { world.remove(actor, MoveIntent); } catch {}
  }
}
