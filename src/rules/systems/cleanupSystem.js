// src/rules/systems/cleanupSystem.js
// Removes entities that have zero (or below) Vitality at the end of the current turn.
// Gameplay rationale: doing cleanup at the end of the turn prevents "dead men walking"
// in subsequent ticks while still allowing all systems in the current turn to react
// to the death (events, affixes, VFX, logging). In-engine, destroy() during a tick
// is deferred to the tick flush, so this acts as end-of-turn removal.

import { Vitality } from "../components/Vitality.js";
import { Inventory } from "../components/Inventory.js";
import { Position } from "../components/Position.js";
import { Collider } from "../components/Collider.js";
import { Player } from "../components/Player.js";
import { ItemInfo } from "../components/ItemInfo.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { ActiveEffects } from "../components/ActiveEffects.js";
import { Equipment } from "../components/Equipment.js";
import { GroundStackOrder } from "../components/GroundStackOrder.js";
import {
  destroyInventoryRoot,
  inventoryItems,
  placeOnGround,
  removeFromInventory,
} from "../utils/inventoryFacade.js";
import { DungeonState } from "../components/DungeonState.js";
import { Pet } from "../components/Pet.js";
import { Owner } from "../components/Owner.js";
import { createRng } from "../../lib/ecs-js/rng.js";
import {
  getMonster,
  getMonsterLootTable,
  getMonsterTags,
} from "../data/monsters.js";
import { dropLoot } from "../data/lootResolver.js";
import { createCorpse } from "../archetypes/Food.js";
import { createFrom } from "../../lib/ecs-js/archetype.js";
import { Ashes, Bone } from "../archetypes/Items.js";
import { isWalkable } from "../environment/dungeon/tileMap.js";

const GROUND_STACK_SEQ_KEY = Symbol.for("jshack:groundStack:seq");

function nextGroundStackSeq(world) {
  const current = Number((/** @type {any} */ (world))[GROUND_STACK_SEQ_KEY] || 0) | 0;
  const next = (current + 1) | 0;
  (/** @type {any} */ (world))[GROUND_STACK_SEQ_KEY] = next;
  return next;
}

function stampGroundTop(world, itemId) {
  if (!(Number(itemId) > 0)) return;
  world.add(itemId, GroundStackOrder, { seq: nextGroundStackSeq(world) });
}

function isSolidBlockedAt(world, x, y, ignoreId = 0) {
  const tx = x | 0;
  const ty = y | 0;
  for (const [id, pos, col] of world.query(Position, Collider)) {
    if ((Number(id) | 0) === (Number(ignoreId) | 0)) continue;
    if (!col?.solid) continue;
    if ((pos.x | 0) !== tx || (pos.y | 0) !== ty) continue;
    return true;
  }
  return false;
}

function makeBurstFallbackOffsets() {
  const out = [];
  for (let r = 2; r <= 3; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const cheb = Math.max(Math.abs(dx), Math.abs(dy));
        if (cheb !== r) continue;
        out.push({ x: dx, y: dy });
      }
    }
  }
  // Keep cardinal-ish placements earlier in fallback ordering.
  out.sort((a, b) => {
    const am = Math.abs(a.x) + Math.abs(a.y);
    const bm = Math.abs(b.x) + Math.abs(b.y);
    return am - bm || a.y - b.y || a.x - b.x;
  });
  return out;
}

const DEATH_BURST_OFFSETS = Object.freeze(makeBurstFallbackOffsets());

function buildDeathBurstTargets(world, deadId, deathPos, count) {
  const n = Math.max(0, Number(count || 0) | 0);
  if (n <= 0) return [];
  const cx = deathPos.x | 0;
  const cy = deathPos.y | 0;

  const q = [{ x: cx, y: cy, d: 0 }];
  const seen = new Set([`${cx},${cy}`]);
  const reachable = [];

  for (let i = 0; i < q.length; i++) {
    const cur = q[i];
    if (cur.d > 3) continue;
    const cheb = Math.max(Math.abs((cur.x | 0) - cx), Math.abs((cur.y | 0) - cy));
    if (cheb >= 2 && cheb <= 3) {
      reachable.push(cur);
    }
    if (cur.d === 3) continue;
    const next = [
      { x: cur.x + 1, y: cur.y },
      { x: cur.x - 1, y: cur.y },
      { x: cur.x, y: cur.y + 1 },
      { x: cur.x, y: cur.y - 1 },
    ];
    for (const p of next) {
      const k = `${p.x},${p.y}`;
      if (seen.has(k)) continue;
      seen.add(k);
      if (!isWalkable(p.x, p.y)) continue;
      if (isSolidBlockedAt(world, p.x, p.y, deadId)) continue;
      q.push({ x: p.x, y: p.y, d: cur.d + 1 });
    }
  }

  let candidates = [];
  if (reachable.length > 0) {
    candidates = reachable.sort((a, b) => a.d - b.d || a.x - b.x || a.y - b.y);
  } else {
    candidates = DEATH_BURST_OFFSETS.map((off, i) => ({
      x: cx + (off.x | 0),
      y: cy + (off.y | 0),
      d: i,
    }));
  }
  if (!candidates.length) return [];

  const base = ((world.seed >>> 0) ^ ((Number(deadId || 0) * 0x517cc1b7) >>> 0) ^ ((world.step | 0) >>> 0)) >>> 0;
  const start = Math.abs(base | 0) % candidates.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = candidates[(start + i) % candidates.length];
    out.push({ x: p.x | 0, y: p.y | 0 });
  }
  return out;
}

function collectDropItemIds(world, actorId) {
  const out = [];
  const seen = new Set();
  const push = (itemId) => {
    const id = Number(itemId || 0) | 0;
    if (!(id > 0) || !world.isAlive(id)) return;
    if (seen.has(id)) return;
    if (!world.has(id, ItemInfo)) return;
    seen.add(id);
    out.push(id);
  };

  for (const itemId of inventoryItems(world, actorId)) push(itemId);

  const eq = world.get(actorId, Equipment);
  if (eq && typeof eq === "object") {
    for (const value of Object.values(eq)) push(value);
  }
  return out;
}

function corpseDropChance(monsterDef, wasPet) {
  if (wasPet) return 1.0;
  if (!monsterDef) return 0;
  if (Number.isFinite(monsterDef.corpseDropChance)) {
    const v = Number(monsterDef.corpseDropChance);
    return Math.max(0, Math.min(1, v));
  }
  return Math.min(1.0, 0.25 + (monsterDef.tier || 0) * 0.10);
}

function isBurningOnDeath(world, id) {
  const ae = world.get(id, ActiveEffects);
  if (!ae || !Array.isArray(ae.effects)) return false;
  return ae.effects.some((effect) => {
    const key = String(effect?.key || "").toLowerCase();
    return key === "burn" || key === "burning";
  });
}

/**
 * Collect all entities with Vitality and remove those whose hp <= 0.
 * Keep this system small and deterministic; drops/epitaphs/etc. can be layered later.
 * @param {import('../../lib/ecs-js/index.js').World} world
 */
export function cleanupSystem(world) {
  for (const [id, vit] of world.query(Vitality)) {
    if (!vit) continue;
    if ((vit.hp | 0) <= 0 && world.isAlive(id)) {
      const ident = world.get(id, NamedIdentity);
      const wasPet = world.has(id, Pet);
      const petOwnerId = wasPet
        ? (Number(world.get(id, Owner)?.ownerId || 0) | 0)
        : 0;
      const monsterDef = ident ? getMonster(ident.identity) : null;
      const effectiveMonsterDef = monsterDef || (wasPet
        ? {
          id: ident?.identity || "pet",
          name: ident?.name || "Pet",
          sizeClass: "S",
          massKg: 10,
          tier: 0,
        }
        : null);

      // Drop all inventory items at the entity's current position before destroying
      const pos = world.get(id, Position);
      if (pos) {
        const items = collectDropItemIds(world, id);
        const shouldBurst = !world.has(id, Player) && items.length > 0;
        const targets = shouldBurst ? buildDeathBurstTargets(world, id, pos, items.length) : [];
        for (let i = 0; i < items.length; i++) {
          const itemId = items[i];
          const info = world.get(itemId, ItemInfo);
          removeFromInventory(world, id, itemId);
          const target = targets[i] || { x: pos.x | 0, y: pos.y | 0 };
          const px = target.x | 0;
          const py = target.y | 0;
          const placed = placeOnGround(world, itemId, px, py, { mergeCompatibleAmmo: true });
          if (placed.itemId > 0) stampGroundTop(world, placed.itemId);
          const finalPos = world.get(placed.itemId || itemId, Position);
          const at = {
            x: Number(finalPos?.x ?? px) | 0,
            y: Number(finalPos?.y ?? py) | 0,
          };
          try {
            world.emit &&
              world.emit("item:dropped", {
                actor: id,
                itemId: placed.itemId || itemId,
                count: info?.count || 1,
                at,
              });
          } catch (e) {
            console.debug("[cleanupSystem] emit item:dropped failed:", e);
          }
        }
      }

      // Generate loot from monster's loot table
      if (ident && pos) {
        if (effectiveMonsterDef) {
          // Drop loot only if there's a real monster definition with a loot table
          if (monsterDef) {
            const tableId = getMonsterLootTable(monsterDef);
            const step = world.step | 0;
            const lootSeed = ((world.seed >>> 0) ^ ((step * 0x9e3779b9) >>> 0) ^
              ((id * 0x517cc1b7) >>> 0)) >>> 0;
            const rng = createRng(lootSeed);
            let depth = 1;
            for (const [, ds] of world.query(DungeonState)) {
              depth = ds.currentDepth || 1;
              break;
            }
            dropLoot(world, tableId, rng, depth, { x: pos.x, y: pos.y });
          }

          // Drop a corpse for the killed monster or pet.
          // Use monster-authored corpseDropChance when present.
          const corpseChance = corpseDropChance(effectiveMonsterDef, wasPet);
          const burnedToDeath = isBurningOnDeath(world, id);
          // Use the RNG if available, otherwise just check corpseChance directly
          let shouldCreateCorpse = false;
          if (burnedToDeath) {
            shouldCreateCorpse = true;
          } else if (monsterDef) {
            const step = world.step | 0;
            const lootSeed = ((world.seed >>> 0) ^ ((step * 0x9e3779b9) >>> 0) ^
              ((id * 0x517cc1b7) >>> 0)) >>> 0;
            const rng = createRng(lootSeed);
            const corpseRoll = rng.next();
            shouldCreateCorpse = corpseRoll < corpseChance;
          } else {
            // For pets without monster defs, always create corpse
            shouldCreateCorpse = wasPet;
          }

          if (shouldCreateCorpse) {
            let droppedId;
            if (burnedToDeath) {
              droppedId = createFrom(world, Ashes, {});
              world.add(droppedId, Position, { x: pos.x, y: pos.y });
            } else {
              // Skeletal monsters drop bones instead of corpses
              const tags = getMonsterTags(effectiveMonsterDef.id);
              const isSkeletal = tags.includes("skeletal");
              if (isSkeletal && !wasPet) {
                droppedId = createFrom(world, Bone, {});
                world.add(droppedId, Position, { x: pos.x, y: pos.y });
              } else {
                droppedId = createCorpse(world, effectiveMonsterDef, {
                  x: pos.x,
                  y: pos.y,
                });
              }
            }

            // If this was a pet, mark the corpse with Pet tag and Owner
            if (!burnedToDeath && wasPet && petOwnerId) {
              try {
                world.add(droppedId, Pet);
                world.add(droppedId, Owner, { ownerId: petOwnerId });
              } catch { /* */ }
            }

            try {
              world.emit &&
                world.emit("item:dropped", {
                  itemId: droppedId,
                  count: 1,
                  at: { x: pos.x, y: pos.y },
                });
            } catch { /* */ }
          }
        }
      }

      // Emit betrayal event if a pet died
      if (wasPet && petOwnerId) {
        try {
          world.emit && world.emit("pet:died", {
            petId: id,
            ownerId: petOwnerId,
            name: ident?.name || "pet",
            at: pos,
          });
        } catch { /* */ }
      }

      destroyInventoryRoot(world, id);
      world.destroy(id);
    }
  }
}
