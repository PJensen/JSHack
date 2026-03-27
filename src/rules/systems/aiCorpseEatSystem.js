// src/rules/systems/aiCorpseEatSystem.js
// Monsters with a corpseEat config consume floor corpses for behaviour-specific
// benefits.  Two behaviours:
//   scavenge — heal HP when hurt (rats, goblins)
//   devour   — gain overhealth above maxHp, capped at 150% (troll, carrion shade)

import { Position }      from "../components/Position.js";
import { Faction }       from "../components/Faction.js";
import { Speed }         from "../components/Speed.js";
import { Vitality }      from "../components/Vitality.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { ItemInfo }      from "../components/ItemInfo.js";
import { Consumable }    from "../components/Consumable.js";
import { FoodDecay }     from "../components/FoodDecay.js";
import { MoveIntent }    from "../components/Intents/MoveIntent.js";
import { playerEntity }  from "../utils/queries.js";
import { Pet }           from "../components/Pet.js";
import { AggroState, AGGRO_LEVELS } from "../components/AggroState.js";
import { getMonster }    from "../data/monsters.js";
import { getDecayStage } from "../data/food.js";
import { forEachInRadius } from "../utils/spatialIndex.js";
import { statusStrength }  from "../utils/statusFacade.js";
import { chebyshevScalar } from "../utils/distance.js";

const ACTIVE_RADIUS = 24;
const COOLDOWN_DEFAULT = 5;
const COOLDOWN_KEY = Symbol.for("jshack:ai:corpseEat:lastTurn");

/** @param {any} world @returns {Map<number, number>} */
function ensureCooldownState(world) {
  if (world[COOLDOWN_KEY] instanceof Map) return world[COOLDOWN_KEY];
  const m = new Map();
  world[COOLDOWN_KEY] = m;
  return m;
}

function isOnCooldown(world, id, cooldownTurns) {
  const last = ensureCooldownState(world).get(id) ?? -1e9;
  return ((world.step | 0) - last) < cooldownTurns;
}

function markUsed(world, id) {
  ensureCooldownState(world).set(id, world.step | 0);
}

function isCorpseOnFloor(world, itemId) {
  if (!world.isAlive(itemId)) return false;
  if (!world.has(itemId, Position)) return false;
  if (world.has(itemId, Pet)) return false;
  if (world.get(itemId, Vitality)) return false;
  const info = world.get(itemId, ItemInfo);
  if (!info || String(info.type || "").toLowerCase() !== "food") return false;
  return String(world.get(itemId, NamedIdentity)?.identity || "")
    .toLowerCase().startsWith("corpse_");
}

function extractNutrition(world, corpseId) {
  const cons = world.get(corpseId, Consumable);
  const base = Math.max(0, Number(cons?.effectParams?.nutrition || 0));
  const decay = world.get(corpseId, FoodDecay);
  if (!decay) return Math.max(1, base);
  const info = getDecayStage(decay.turnsHeld, decay.shelfLife);
  return Math.max(1, Math.floor(base * info.nutritionMult));
}

// ── Behaviours ──────────────────────────────────────────────────────

function applyScavenge(world, id, vit, nutrition) {
  const heal = Math.max(1, Math.floor(nutrition / 100));
  const actual = Math.min((vit.maxHp | 0) - (vit.hp | 0), heal);
  if (actual > 0) vit.hp += actual;
  try { world.emit?.("healed", { id, amount: actual }); } catch {}
  return { healAmount: actual };
}

function applyDevour(world, id, vit, nutrition) {
  const gain = Math.max(1, Math.floor(nutrition / 80));
  const cap = Math.floor((vit.maxHp | 0) * 1.5);
  const actual = Math.min(cap - (vit.hp | 0), gain);
  if (actual > 0) vit.hp += actual;
  try { world.emit?.("healed", { id, amount: actual }); } catch {}
  return { healAmount: actual };
}

// ── Main system ─────────────────────────────────────────────────────

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function aiCorpseEatSystem(world) {
  const _player = playerEntity(world);
  if (!_player) return;
  const playerPos = _player.pos;

  /** Track corpses consumed this tick so two monsters can't eat the same one. */
  const consumed = new Set();

  forEachInRadius(world, playerPos.x, playerPos.y, ACTIVE_RADIUS, (id, pos) => {
    const fac = world.get(id, Faction);
    if (!fac || fac.key !== "enemy") return;

    const ni  = world.get(id, NamedIdentity);
    const def = ni ? getMonster(String(ni.identity || "")) : null;
    if (!def || !def.corpseEat) return;

    const config = def.corpseEat;
    const behavior = config.behavior;
    if (!behavior) return;

    // Speed gate
    const spd = world.get(id, Speed);
    let actEvery = (spd && spd.actEvery > 1) ? spd.actEvery : 1;
    const frostStacks = Math.min(3, statusStrength(world, id, "frozen"));
    if (frostStacks > 0) actEvery = actEvery * (1 + frostStacks);
    if (actEvery > 1 && ((world.step + id) % actEvery) !== 0) return;

    // Skip if another AI system already queued an action
    if (world.has(id, MoveIntent)) return;

    // Aggro eligibility — idle monsters scavenge freely; hunting only if smart
    // and not adjacent to the player
    const aggro = world.get(id, AggroState);
    const alertLevel = aggro?.alertLevel || AGGRO_LEVELS.unaware;
    if (alertLevel === AGGRO_LEVELS.hunting) {
      if ((def.intelligence ?? 10) < 6) return;
      if (chebyshevScalar(pos.x, pos.y, playerPos.x, playerPos.y) <= 1) return;
    }

    // Cooldown
    if (isOnCooldown(world, id, config.cooldownTurns ?? COOLDOWN_DEFAULT)) return;

    // Behaviour-specific guard
    const vit = world.get(id, Vitality);
    if (!vit || (vit.hp | 0) <= 0) return;

    if (behavior === "scavenge") {
      const threshold = config.hpThreshold ?? 0.75;
      if ((vit.hp / Math.max(1, vit.maxHp)) >= threshold) return;
    }

    // Scan for a corpse on or adjacent to the monster
    let corpseId = null;
    forEachInRadius(world, pos.x | 0, pos.y | 0, 1, (itemId) => {
      if (corpseId !== null) return;
      if (consumed.has(itemId)) return;
      if (isCorpseOnFloor(world, itemId)) corpseId = itemId;
    });
    if (corpseId === null) return;

    consumed.add(corpseId);

    const nutrition = extractNutrition(world, corpseId);
    const corpseName = String(world.get(corpseId, NamedIdentity)?.name || "corpse");
    let result;

    if (behavior === "devour") {
      result = applyDevour(world, id, vit, nutrition);
    } else {
      result = applyScavenge(world, id, vit, nutrition);
    }

    try { world.destroy(corpseId); } catch {}
    markUsed(world, id);

    try {
      world.emit?.("monster:corpse-eat", {
        monsterId: id,
        monsterName: def.name,
        behavior,
        corpseName,
        at: { x: pos.x | 0, y: pos.y | 0 },
        healAmount: result.healAmount || 0,
      });
    } catch {}
  });
}
