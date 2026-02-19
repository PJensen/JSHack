import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { Faction } from "../src/rules/components/Faction.js";
import { MoveIntent } from "../src/rules/components/Intents/MoveIntent.js";
import { AttackIntent } from "../src/rules/components/Intents/AttackIntent.js";
import { Player } from "../src/rules/components/Player.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";
import { clearAll, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";
import { aiChaseSystem } from "../src/rules/systems/aiChaseSystem.js";
import { combatSystem } from "../src/rules/systems/combatSystem.js";
import { effectSystem } from "../src/rules/systems/effectSystem.js";
import { movementSystem } from "../src/rules/systems/movementSystem.js";
import { installTauntListener, tauntSteeringSystem } from "../src/rules/systems/tauntSystem.js";

function loadFloorChunk() {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);
}

Deno.test("taunt:apply-area applies to target faction only and emits one-shot vfx", () => {
  const world = new World({ seed: 7101 });
  installTauntListener(world);

  const source = world.create();
  world.add(source, Position, { x: 5, y: 5 });
  world.add(source, Faction, { key: "stone_taunter" });

  const enemy = world.create();
  world.add(enemy, Position, { x: 7, y: 5 });
  world.add(enemy, Faction, { key: "enemy" });

  const neutral = world.create();
  world.add(neutral, Position, { x: 6, y: 6 });
  world.add(neutral, Faction, { key: "neutral" });

  const statusEvents = [];
  world.on("status", (ev) => statusEvents.push(ev));

  world.emit("taunt:apply-area", {
    sourceId: source,
    x: 5,
    y: 5,
    radius: 4,
    turnsLeft: 3,
    potency: 1,
    targetFaction: "enemy",
    vfxText: "!",
  });

  const enemyEffects = world.get(enemy, ActiveEffects);
  assert(Array.isArray(enemyEffects?.effects), "enemy should receive active effects");
  const taunt = enemyEffects.effects.find((e) => e.key === "taunt");
  assert(taunt, "enemy should receive taunt effect");
  assertEquals(taunt.sourceId, source);
  assertEquals(taunt.turnsLeft, 3);

  const neutralEffects = world.get(neutral, ActiveEffects);
  assertEquals(Array.isArray(neutralEffects?.effects), false);

  const enemyVfx = statusEvents.filter((ev) => ev.id === enemy && String(ev.text) === "!");
  const neutralVfx = statusEvents.filter((ev) => ev.id === neutral && String(ev.text) === "!");
  assertEquals(enemyVfx.length, 1);
  assertEquals(neutralVfx.length, 0);
});

Deno.test("tauntSteeringSystem rewrites enemy MoveIntent toward taunt source", () => {
  const world = new World({ seed: 7102 });

  const source = world.create();
  world.add(source, Position, { x: 6, y: 5 });

  const enemy = world.create();
  world.add(enemy, Position, { x: 3, y: 5 });
  world.add(enemy, Faction, { key: "enemy" });
  world.add(enemy, MoveIntent, { dx: 0, dy: -1 });
  world.add(enemy, ActiveEffects, {
    effects: [{ key: "taunt", turnsLeft: 3, potency: 1, sourceId: source }],
  });

  tauntSteeringSystem(world);

  const intent = world.get(enemy, MoveIntent);
  assert(intent, "enemy should still have move intent");
  assertEquals(intent.dx, 1);
  assertEquals(intent.dy, 0);
});

Deno.test("stone taunt aura persists across turns and catches enemies entering radius", () => {
  const world = new World({ seed: 7105 });
  installTauntListener(world);

  const statue = world.create();
  world.add(statue, Position, { x: 10, y: 10 });
  world.add(statue, NamedIdentity, { name: "Taunting Statue", identity: "stone_taunter" });
  world.add(statue, Faction, { key: "stone_taunter" });

  const enemyNear = world.create();
  world.add(enemyNear, Position, { x: 12, y: 10 });
  world.add(enemyNear, Faction, { key: "enemy" });

  const enemyFar = world.create();
  world.add(enemyFar, Position, { x: 20, y: 10 });
  world.add(enemyFar, Faction, { key: "enemy" });

  world.emit("spawned", {
    id: statue,
    kind: "monster",
    at: { x: 10, y: 10 },
  });

  let nearTaunt = world.get(enemyNear, ActiveEffects)?.effects?.find((e) => e.key === "taunt");
  assert(nearTaunt, "near enemy should get initial taunt pulse on spawn");
  assertEquals(nearTaunt.turnsLeft, 3);
  assert(!world.get(enemyFar, ActiveEffects), "enemy outside radius should not receive taunt");

  effectSystem(world);
  nearTaunt = world.get(enemyNear, ActiveEffects)?.effects?.find((e) => e.key === "taunt");
  assert(nearTaunt, "taunt should remain after one effect tick");
  assertEquals(nearTaunt.turnsLeft, 2, "effect tick should decrement taunt");

  tauntSteeringSystem(world);
  nearTaunt = world.get(enemyNear, ActiveEffects)?.effects?.find((e) => e.key === "taunt");
  assert(nearTaunt, "taunt should be refreshed by persistent aura");
  assertEquals(nearTaunt.turnsLeft, 3, "persistent aura should refresh taunt duration");

  world.set(enemyFar, Position, { x: 13, y: 10 });
  tauntSteeringSystem(world);
  const farTaunt = world.get(enemyFar, ActiveEffects)?.effects?.find((e) => e.key === "taunt");
  assert(farTaunt, "enemy entering radius should be taunted on later turns");
  assertEquals(farTaunt.sourceId, statue);
});

Deno.test("taunted enemy bump-attacks statue and can damage it", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 7103 });

    const statue = world.create();
    world.add(statue, Position, { x: 4, y: 3 });
    world.add(statue, Faction, { key: "stone_taunter" });
    world.add(statue, Vitality, { maxHp: 45, hp: 45 });
    world.add(statue, Equipment, {});

    const enemy = world.create();
    world.add(enemy, Position, { x: 3, y: 3 });
    world.add(enemy, Faction, { key: "enemy" });
    world.add(enemy, Vitality, { maxHp: 30, hp: 30 });
    world.add(enemy, Equipment, { attackDerived: 100, naturalDamageDice: "1d8" });
    world.add(enemy, ActiveEffects, {
      effects: [{ key: "taunt", turnsLeft: 3, potency: 1, sourceId: statue }],
    });
    world.add(enemy, MoveIntent, { dx: 0, dy: 1 });

    tauntSteeringSystem(world);
    movementSystem(world);

    const bumpIntent = world.get(enemy, AttackIntent);
    assert(bumpIntent, "adjacent taunted enemy should produce AttackIntent against statue");
    assertEquals(bumpIntent.targetId, statue);

    const startHp = world.get(statue, Vitality).hp;
    let damaged = false;
    for (let i = 0; i < 12; i++) {
      if (!world.has(enemy, AttackIntent)) {
        world.add(enemy, AttackIntent, { targetId: statue });
      }
      combatSystem(world);
      if (world.get(statue, Vitality).hp < startHp) {
        damaged = true;
        break;
      }
    }
    assert(damaged, "statue should take damage from enemy bump-attacks (no friendly-fire block)");
  } finally {
    clearAll();
  }
});

Deno.test("pet does not attack allied stone_taunter", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 7106 });

    const statue = world.create();
    world.add(statue, Position, { x: 4, y: 3 });
    world.add(statue, Faction, { key: "stone_taunter" });
    world.add(statue, Vitality, { maxHp: 45, hp: 45 });
    world.add(statue, Equipment, {});

    const pet = world.create();
    world.add(pet, Position, { x: 3, y: 3 });
    world.add(pet, Faction, { key: "pet" });
    world.add(pet, Vitality, { maxHp: 30, hp: 30 });
    world.add(pet, Equipment, { attackDerived: 100, naturalDamageDice: "1d8" });

    world.add(pet, MoveIntent, { dx: 1, dy: 0 });
    movementSystem(world);
    assertEquals(world.has(pet, AttackIntent), false, "pet bump should not create AttackIntent against allied statue");

    const startHp = world.get(statue, Vitality).hp;
    world.add(pet, AttackIntent, { targetId: statue });
    combatSystem(world);
    assertEquals(world.get(statue, Vitality).hp, startHp, "combat gate should block non-hostile pet attack");
  } finally {
    clearAll();
  }
});

Deno.test("stone_taunter faction does not receive ai chase MoveIntent", () => {
  const world = new World({ seed: 7104 });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });

  const statue = world.create();
  world.add(statue, Position, { x: 8, y: 5 });
  world.add(statue, Faction, { key: "stone_taunter" });

  aiChaseSystem(world);

  assertEquals(world.has(statue, MoveIntent), false);
});
