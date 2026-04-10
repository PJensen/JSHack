import { World } from "../../src/lib/ecs-js/index.js";
import { configureWorld } from "../../src/main/scheduler.js";
import { movementSystem } from "../../src/rules/systems/movementSystem.js";
import { combatSystem } from "../../src/rules/systems/combatSystem.js";
import { buildWorldView } from "../../src/bridge/schema/worldView.js";

import { Player } from "../../src/rules/components/Player.js";
import { Position } from "../../src/rules/components/Position.js";
import { Vitality } from "../../src/rules/components/Vitality.js";
import { Equipment } from "../../src/rules/components/Equipment.js";
import { Faction } from "../../src/rules/components/Faction.js";
import { NamedIdentity } from "../../src/rules/components/NamedIdentity.js";
import { Collider } from "../../src/rules/components/Collider.js";
import { ItemInfo } from "../../src/rules/components/ItemInfo.js";
import { MoveIntent } from "../../src/rules/components/Intents/MoveIntent.js";
import { AttackIntent } from "../../src/rules/components/Intents/AttackIntent.js";
import { DungeonState } from "../../src/rules/components/DungeonState.js";

import { CHUNK_SIZE, TILE_FLOOR } from "../../src/rules/environment/dungeon/constants.js";
import { clearAll, loadChunk } from "../../src/rules/environment/dungeon/tileMap.js";

function loadFlatChunks(radius = 1) {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  for (let cy = -radius; cy <= radius; cy++) {
    for (let cx = -radius; cx <= radius; cx++) {
      loadChunk(cx, cy, tiles);
    }
  }
}

function createFullTickContext() {
  loadFlatChunks(2);
  const world = new World({ seed: 0xC0FFEE });
  configureWorld(world);

  world.add(world.create(), DungeonState, { currentDepth: 1, profileType: "default" });

  const player = world.create();
  world.add(player, Player, { controlled: true });
  world.add(player, Position, { x: 10, y: 10 });
  world.add(player, Vitality, { hp: 100, maxHp: 100 });
  world.add(player, Equipment, { accuracyDerived: 12, damagePowerDerived: 8, naturalDamageDice: "1d4" });
  world.add(player, Faction, { key: "player" });
  world.add(player, NamedIdentity, { name: "Player", identity: "player" });

  const actorIds = [];
  let x = 4;
  let y = 20;
  for (let i = 0; i < 256; i++) {
    const id = world.create();
    actorIds.push(id);
    world.add(id, Position, { x, y });
    world.add(id, Vitality, { hp: 24, maxHp: 24 });
    world.add(id, Equipment, { accuracyDerived: 6, damagePowerDerived: 4, naturalDamageDice: "1d2" });
    world.add(id, Faction, { key: "enemy" });
    world.add(id, NamedIdentity, { name: "Mob", identity: "mob" });
    x += 2;
    if (x > 56) {
      x = 4;
      y += 2;
    }
  }

  return {
    world,
    actorIds,
    iter: 0,
  };
}

function createMovementContext() {
  loadFlatChunks(2);
  const world = new World({ seed: 0xA77A77 });
  const actorIds = [];

  let x = 2;
  let y = 2;
  for (let i = 0; i < 2000; i++) {
    const id = world.create();
    actorIds.push(id);
    world.add(id, Position, { x, y });
    world.add(id, Vitality, { hp: 10, maxHp: 10 });
    world.add(id, Faction, { key: "enemy" });
    x += 2;
    if (x > 58) {
      x = 2;
      y += 1;
    }
  }

  return {
    world,
    actorIds,
    iter: 0,
  };
}

function createCombatContext() {
  loadFlatChunks(2);
  const world = new World({ seed: 0xBADC0DE });
  const pairs = [];

  let x = 2;
  let y = 2;
  for (let i = 0; i < 600; i++) {
    const attacker = world.create();
    const defender = world.create();

    world.add(attacker, Position, { x, y });
    world.add(attacker, Vitality, { hp: 100, maxHp: 100 });
    world.add(attacker, Equipment, { accuracyDerived: 100, damagePowerDerived: 12, naturalDamageDice: "1d3" });
    world.add(attacker, Faction, { key: "player" });

    world.add(defender, Position, { x: x + 1, y });
    world.add(defender, Vitality, { hp: 1000000, maxHp: 1000000 });
    world.add(defender, Equipment, {});
    world.add(defender, Faction, { key: "enemy" });

    pairs.push([attacker, defender]);

    x += 3;
    if (x > 56) {
      x = 2;
      y += 1;
    }
  }

  return { world, pairs };
}

function createWorldViewContext() {
  loadFlatChunks(3);
  const world = new World({ seed: 0x1BADB002 });

  world.add(world.create(), DungeonState, { currentDepth: 1, profileType: "default" });

  const player = world.create();
  world.add(player, Player, { controlled: true });
  world.add(player, Position, { x: 40, y: 40 });
  world.add(player, Vitality, { hp: 60, maxHp: 60 });
  world.add(player, Equipment, { accuracyDerived: 8, damagePowerDerived: 6, naturalDamageDice: "1d4" });
  world.add(player, Faction, { key: "player" });
  world.add(player, NamedIdentity, { name: "Player", identity: "player" });

  for (let i = 0; i < 1500; i++) {
    const id = world.create();
    const x = 6 + (i % 70);
    const y = 6 + ((i / 70) | 0);
    world.add(id, Position, { x, y });
    world.add(id, NamedIdentity, { name: "Monster", identity: "goblin" });
    world.add(id, Vitality, { hp: 12, maxHp: 12 });
    world.add(id, Faction, { key: "enemy" });
  }

  for (let i = 0; i < 2000; i++) {
    const id = world.create();
    const x = 10 + (i % 80);
    const y = 30 + ((i / 80) | 0);
    world.add(id, Position, { x, y });
    world.add(id, NamedIdentity, { name: "Item", identity: "gold" });
    world.add(id, ItemInfo, { type: "currency", count: (i % 50) + 1 });
  }

  for (let i = 0; i < 400; i++) {
    const id = world.create();
    const x = 4 + (i % 60);
    const y = 4 + ((i / 60) | 0);
    world.add(id, Position, { x, y });
    world.add(id, Collider, { solid: true, blocksSight: true });
    world.add(id, NamedIdentity, { name: "WallObj", identity: "wall_object" });
  }

  return { world };
}

const fullTick = createFullTickContext();
const moveOnly = createMovementContext();
const combatOnly = createCombatContext();
const worldView = createWorldViewContext();

Deno.bench({
  name: "systems: full tick (256 actors)",
  group: "jshack-systems",
  warmup: 3,
  n: 25,
  fn() {
    const dx = (fullTick.iter & 1) === 0 ? 1 : -1;
    fullTick.iter += 1;
    for (let i = 0; i < fullTick.actorIds.length; i++) {
      fullTick.world.add(fullTick.actorIds[i], MoveIntent, { dx, dy: 0 });
    }
    fullTick.world.tick(1);
  },
});

Deno.bench({
  name: "systems: movementSystem (2000 actors)",
  group: "jshack-systems",
  warmup: 3,
  n: 40,
  fn() {
    const dx = (moveOnly.iter & 1) === 0 ? 1 : -1;
    moveOnly.iter += 1;
    for (let i = 0; i < moveOnly.actorIds.length; i++) {
      moveOnly.world.add(moveOnly.actorIds[i], MoveIntent, { dx, dy: 0 });
    }
    movementSystem(moveOnly.world);
  },
});

Deno.bench({
  name: "systems: combatSystem (600 pairs)",
  group: "jshack-systems",
  warmup: 3,
  n: 35,
  fn() {
    for (let i = 0; i < combatOnly.pairs.length; i++) {
      const [attacker, defender] = combatOnly.pairs[i];
      combatOnly.world.add(attacker, AttackIntent, { targetId: defender });
    }

    combatSystem(combatOnly.world);

    for (let i = 0; i < combatOnly.pairs.length; i++) {
      const defender = combatOnly.pairs[i][1];
      const vit = combatOnly.world.get(defender, Vitality);
      if (vit) vit.hp = vit.maxHp;
    }
  },
});

Deno.bench({
  name: "systems: buildWorldView (3500 entities)",
  group: "jshack-systems",
  warmup: 3,
  n: 30,
  fn() {
    worldView.world.step += 1;
    buildWorldView(worldView.world);
  },
});

Deno.test("perf bench teardown", () => {
  clearAll();
});
