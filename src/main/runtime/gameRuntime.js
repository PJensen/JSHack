import { World } from "../../lib/ecs-js/index.js";
import { configureWorld } from "../scheduler.js";
import { makeRulesDispatcher } from "../input/rulesDispatch.js";
import { buildWorldView } from "../../bridge/schema/worldView.js";

import { initDungeon } from "../../rules/environment/dungeon/index.js";
import { createPlayer } from "../../rules/archetypes/Player.js";
import { getClass } from "../../rules/data/classes.js";
import { createItemById } from "../../rules/utils/itemFactory.js";
import { addToInventory } from "../../rules/utils/inventoryFacade.js";
import { playerEntity } from "../../rules/utils/queries.js";
import { initDeity } from "../../rules/systems/deitySystem.js";

import { Equipment } from "../../rules/components/Equipment.js";
import { Mana } from "../../rules/components/Mana.js";
import { Hunger } from "../../rules/components/Hunger.js";
import { Brain } from "../../rules/components/Brain.js";
import { BaseStats } from "../../rules/components/BaseStats.js";
import { Devotion } from "../../rules/components/Devotion.js";
import { Vitality } from "../../rules/components/Vitality.js";
import { DungeonState } from "../../rules/components/DungeonState.js";
import { effectiveMaxHp } from "../../rules/utils/passiveBonuses.js";

import { PHASE_TURNS } from "../../rules/data/calendar.js";

function coerceInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? (n | 0) : fallback;
}

function upsert(world, entityId, component, value) {
  if (world.has(entityId, component)) {
    world.set(entityId, component, value);
  } else {
    world.add(entityId, component, value);
  }
}

function applyClassLoadout(world, playerId, classDef) {
  const stats = classDef?.stats || {};

  upsert(world, playerId, Mana, {
    mana: stats.maxMana ?? 50,
    maxMana: stats.maxMana ?? 50,
    manaRegen: stats.manaRegen ?? 0.1,
  });

  upsert(world, playerId, Hunger, {
    hunger: 0,
    satiation: 100,
  });

  const baseStats = world.has(playerId, BaseStats) ? (world.get(playerId, BaseStats) || {}) : {};
  upsert(world, playerId, BaseStats, {
    ...baseStats,
    strength: stats.strength ?? baseStats.strength ?? 10,
    intelligence: stats.intelligence ?? baseStats.intelligence ?? 10,
    dexterity: stats.dexterity ?? baseStats.dexterity ?? 10,
    vitality: stats.vitality ?? baseStats.vitality ?? 10,
    perception: stats.perception ?? baseStats.perception ?? 5,
  });

  const addStarterItem = (itemId, opts = {}) => {
    const createdId = createItemById(world, itemId, opts);
    if (!(createdId > 0)) return 0;
    const ok = addToInventory(world, playerId, createdId, { silent: true });
    return ok ? createdId : 0;
  };

  const eq = world.get(playerId, Equipment) || {};
  for (const [slot, itemId] of Object.entries(classDef?.equipment || {})) {
    if (!(slot in eq)) continue;
    eq[slot] = itemId ? (addStarterItem(itemId) || null) : null;
  }
  upsert(world, playerId, Equipment, eq);

  const invItems = Array.isArray(classDef?.inventoryItems) ? classDef.inventoryItems : [];
  for (const row of invItems) {
    if (!row || !row.itemId) continue;
    addStarterItem(row.itemId, { count: coerceInt(row.count, 1) || 1 });
  }

  const classSpells = Array.isArray(classDef?.startingSpells)
    ? classDef.startingSpells.filter(Boolean).map((s) => String(s))
    : [];
  if (classSpells.length > 0) {
    const brain = world.get(playerId, Brain);
    if (brain) {
      const existing = Array.isArray(brain.learnedSpellIds)
        ? brain.learnedSpellIds.filter((id) => !classSpells.includes(id))
        : [];
      brain.learnedSpellIds = [...classSpells, ...existing];
      upsert(world, playerId, Brain, brain);
    }
  }

  const deityId = String(classDef?.deityId || "").trim();
  if (deityId) {
    upsert(world, playerId, Devotion, {
      deityId,
      pantheon: true,
    });
    initDeity(deityId, world);
  }
}

/**
 * Create a headless-capable runtime facade around the live world.
 *
 * @param {{
 *   seed?: number,
 *   classId?: string,
 *   playerName?: string,
 *   startDepth?: number,
 *   dungeonType?: string | null,
 *   onAction?: (turn:number, type:string, payload:object)=>void,
 * }} [opts]
 */
export function createGameRuntime(opts = {}) {
  const seed = Number.isFinite(Number(opts.seed)) ? (Number(opts.seed) >>> 0) : 0xC0FFEE;
  const classId = String(opts.classId || "outlaw");
  const classDef = getClass(classId) || getClass("outlaw");
  const playerName = String(opts.playerName || "Headless Hero");
  const startDepth = Math.max(0, coerceInt(opts.startDepth, 1));

  const world = new World({ seed });
  configureWorld(world);

  const spawnPos = initDungeon(world, {
    startDepth,
    dungeonType: opts.dungeonType ?? null,
    tombstoneRepo: null,
  });

  world.step = PHASE_TURNS.sleep + PHASE_TURNS.breakfast;

  if (!playerEntity(world)) {
    const stats = classDef?.stats || {};
    createPlayer(world, {
      x: spawnPos.x,
      y: spawnPos.y,
      name: playerName,
      identity: classDef ? `player_${classDef.id}` : "player",
      maxHp: stats.maxHp ?? 20,
      maxStamina: stats.maxStamina ?? 100,
      staminaRegen: stats.staminaRegen ?? 3.0,
    });
  }

  const pe = playerEntity(world);
  if (!pe) throw new Error("createGameRuntime: failed to create player entity");

  applyClassLoadout(world, pe.id, classDef);

  // Initial resolve pass for derived systems before first external step.
  world.tick(1);

  const dispatch = makeRulesDispatcher(world, () => (playerEntity(world)?.id || 0), {
    onAction: typeof opts.onAction === "function" ? opts.onAction : undefined,
  });

  function getDepth() {
    for (const [, ds] of world.query(DungeonState)) {
      return Number(ds.currentDepth || 0) | 0;
    }
    return 0;
  }

  function snapshot() {
    const player = playerEntity(world);
    const vit = player ? world.get(player.id, Vitality) : null;
    const maxHpEffective = (player && vit) ? Number(effectiveMaxHp(world, player.id, vit) || 0) : 0;
    return {
      step: world.step | 0,
      seed: world.seed >>> 0,
      depth: getDepth(),
      entitiesAlive: world.alive.size,
      player: player
        ? {
            id: player.id,
            pos: player.pos,
            hp: Number(vit?.hp || 0),
            maxHp: maxHpEffective,
          }
        : null,
    };
  }

  return {
    world,
    dispatch,
    tick(turns = 1) {
      const n = Math.max(0, coerceInt(turns, 1));
      if (n > 0) world.tick(n);
    },
    view() {
      return buildWorldView(world);
    },
    snapshot,
    getPlayer() {
      return playerEntity(world);
    },
  };
}
