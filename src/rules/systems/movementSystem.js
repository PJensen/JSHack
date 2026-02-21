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
import { Settings } from "../components/Settings.js";
import { AttackIntent } from "../components/Intents/AttackIntent.js";
import { Faction } from "../components/Faction.js";
import { Player } from "../components/Player.js";
import { Facing } from "../components/Facing.js";
import { STAMINA_REGEN_COOLDOWN } from "../data/regenConstants.js";
import { getTileQuerySnapshot } from "../utils/tileQueryCache.js";
import { areFactionsHostile } from "../utils/factionHostility.js";
import { combatSeed, mulberry32 } from "../utils/rng.js";
import { statusStrength } from "../utils/statusFacade.js";
import {
  addItemEntityToInventory,
  findInventoryStackTargetForItem,
} from "../utils/inventoryStacking.js";

/** @param {number} x @param {number} y */
function key(x, y) { return `${x},${y}`; }

const MISSTEP_DIRS = Object.freeze([
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],            [1, 0],
  [-1, 1],  [0, 1],   [1, 1],
]);

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
      const confusePower = statusStrength(world, actor, "confused");
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
          } catch (e) { console.debug('[movementSystem] emit status:confused-misstep failed:', e); }
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
          const actorFaction = world.get(actor, Faction);
          const fac = world.get(target, Faction);
          if (fac && (fac.key === 'shopkeeper' || fac.key === 'neutral') && world.has(target, Interactable)) {
            // Emit bump-interact event for cross-system communication without direct coupling
            try { world.emit?.("bump:interact", { actor, target }); } catch (e) { console.debug('[movementSystem] emit bump:interact failed:', e); }
          } else if (areFactionsHostile(actorFaction?.key, fac?.key)) {
            // Prefer immediate event-driven bump-attack resolution so attacks
            // can land in the same tick when structural intent adds are deferred.
            // Fallback to AttackIntent when no listener is installed (e.g. unit tests).
            if (!world.has(actor, AttackIntent)) {
              let handled = 0;
              try {
                handled = Number(world.emit?.("bump:attack", { attacker: actor, target }) || 0);
              } catch {
                handled = 0;
              }
              if (handled <= 0) {
                try { world.add(actor, AttackIntent, { targetId: target }); } catch {} // ECS: may already exist
              }
            }
          } else {
            // Non-hostile living blockers (e.g., pets and allied summons) should not trigger bump-attacks.
          }
        } else if (world.has(actor, Player)) {
          // No living target — try interactable (e.g., closed door, chest)
          // Only the player can bump-interact with objects; monsters just bounce off.
          // Emit bump-interact event for cross-system communication without direct coupling
          const targetId = interactables.get(k);
          if (targetId) {
            try { world.emit?.("bump:interact", { actor, target: targetId }); } catch (e) { console.debug('[movementSystem] emit bump:interact failed:', e); }
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
                  try { world.emit?.("tile:dug", { actor, x: nx, y: ny }); } catch (e) { console.debug('[movementSystem] emit tile:dug failed:', e); }
                } else {
                  try { world.emit?.("attack:insufficient-stamina", { attacker: actor, need: cost, have: Number(stam?.stamina ?? 0) }); } catch (e) { console.debug('[movementSystem] emit attack:insufficient-stamina failed:', e); }
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
              const stackTarget = findInventoryStackTargetForItem(world, inv, itemId);
              if (stackTarget) {
                addItemEntityToInventory(world, inv, itemId);
              } else {
                // capacity gate: allow if capacity not set or there's room
                // Special case: currency ignores capacity so monsters can hoard gold even with capacity 0
                const ignoreCapacity = info.type === 'currency';
                if (ignoreCapacity || inv.capacity == null || inv.items.length < inv.capacity) {
                  addItemEntityToInventory(world, inv, itemId);
                } else {
                  // no capacity — skip silently for now
                }
              }
              try { world.emit && world.emit('item:pickup', { actor, itemId, count }); } catch (e) { console.debug('[movementSystem] emit item:pickup failed:', e); }
            }
          }
        }
      }
    } catch (e) { console.error('[movementSystem] movement resolution failed:', e); }
    // Consume the intent regardless
    try { world.remove(actor, MoveIntent); } catch {} // ECS: may not exist
  }
}
