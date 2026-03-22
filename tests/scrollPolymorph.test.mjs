import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createFrom } from "../src/lib/ecs-js/archetype.js";
import { Monster } from "../src/rules/archetypes/Creatures.js";
import { Polymorph } from "../src/rules/components/Polymorph.js";
import { Position } from "../src/rules/components/Position.js";
import { Faction } from "../src/rules/components/Faction.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Traits } from "../src/rules/components/Traits.js";
import { Player } from "../src/rules/components/Player.js";
import {
  resolvePolymorph,
  installPolymorphListener,
  clearPolymorphHooks,
} from "../src/rules/systems/polymorphSystem.js";
import { getMonster, listAllMonsterIds } from "../src/rules/data/monsters.js";

function makeMonster(world, x, y, identity) {
  const def = getMonster(identity);
  assert(def, `monster def for '${identity}' must exist`);
  return createFrom(world, Monster, {
    x, y,
    name: def.name,
    identity: def.id,
    maxHp: Math.floor(def.baseHp + 1 * def.hpPerLevel),
    faction: "enemy",
    accuracyDerived: def.attack,
    damagePowerDerived: def.attack,
    evadeDerived: def.defense,
    naturalDamageDice: def.damageDice,
    sizeClass: def.sizeClass,
    massKg: def.massKg,
    resistances: def.resistances,
    speed: def.speed,
  });
}

function makePlayer(world, x, y) {
  const id = world.create();
  world.add(id, Player);
  world.add(id, Position, { x, y });
  world.add(id, NamedIdentity, { name: "Hero", identity: "player" });
  world.add(id, Traits, {});
  return id;
}

// ── resolvePolymorph basics ──────────────────────────────────────────

Deno.test("resolvePolymorph transforms entity when Polymorph component is present", () => {
  clearPolymorphHooks();
  const world = new World({ seed: 1 });
  installPolymorphListener(world);

  const ratId = makeMonster(world, 5, 5, "rat");
  world.add(ratId, Polymorph, {
    targetIdentity: "goblin",
    trigger: "scroll",
    once: true,
    revealed: false,
    hookKey: "",
    depth: 1,
  });

  const spawnedId = resolvePolymorph(world, {
    entityId: ratId,
    targetIdentity: "goblin",
    depth: 1,
    trigger: "scroll",
    reason: "scroll_polymorph",
  });

  assert(spawnedId > 0, "should return spawned entity id");
  assert(!world.isAlive(ratId), "original rat should be destroyed");
  assert(world.isAlive(spawnedId), "new goblin should be alive");
  assertEquals(world.get(spawnedId, NamedIdentity)?.identity, "goblin");
  assertEquals(world.get(spawnedId, Faction)?.key, "enemy");
  assert((world.get(spawnedId, Vitality)?.hp || 0) > 0, "goblin should have HP");
});

Deno.test("resolvePolymorph preserves position of original entity", () => {
  clearPolymorphHooks();
  const world = new World({ seed: 2 });
  installPolymorphListener(world);

  const snakeId = makeMonster(world, 10, 15, "snake");
  world.add(snakeId, Polymorph, {
    targetIdentity: "orc",
    trigger: "scroll",
    once: true,
    revealed: false,
    hookKey: "",
    depth: 2,
  });

  const spawnedId = resolvePolymorph(world, {
    entityId: snakeId,
    targetIdentity: "orc",
    depth: 2,
    trigger: "scroll",
  });

  assert(spawnedId > 0);
  const pos = world.get(spawnedId, Position);
  assertEquals(pos.x, 10, "should keep original x");
  assertEquals(pos.y, 15, "should keep original y");
});

Deno.test("resolvePolymorph returns 0 when entity has no Polymorph component", () => {
  clearPolymorphHooks();
  const world = new World({ seed: 3 });
  installPolymorphListener(world);

  const batId = makeMonster(world, 3, 3, "bat");
  // Intentionally no Polymorph component

  const result = resolvePolymorph(world, {
    entityId: batId,
    targetIdentity: "goblin",
    depth: 1,
    trigger: "scroll",
  });

  assertEquals(result, 0, "should return 0 without Polymorph component");
  assert(world.isAlive(batId), "bat should still be alive");
});

Deno.test("resolvePolymorph returns 0 for invalid target identity", () => {
  clearPolymorphHooks();
  const world = new World({ seed: 4 });
  installPolymorphListener(world);

  const ratId = makeMonster(world, 5, 5, "rat");
  world.add(ratId, Polymorph, {
    targetIdentity: "nonexistent_monster",
    trigger: "scroll",
    once: true,
    revealed: false,
    hookKey: "",
    depth: 1,
  });

  const result = resolvePolymorph(world, {
    entityId: ratId,
    targetIdentity: "nonexistent_monster",
    depth: 1,
    trigger: "scroll",
  });

  assertEquals(result, 0, "should return 0 for unknown monster");
  assert(world.isAlive(ratId), "rat should still be alive");
});

// ── scroll flow simulation ───────────────────────────────────────────

Deno.test("scroll polymorph flow: add Polymorph component then resolve transforms enemy", () => {
  clearPolymorphHooks();
  const world = new World({ seed: 10 });
  installPolymorphListener(world);

  const playerId = makePlayer(world, 5, 5);
  const goblinId = makeMonster(world, 7, 5, "goblin");

  // Simulate what the scroll onConfirm does: add Polymorph then resolve
  const targetIdentity = "orc";
  try {
    world.add(goblinId, Polymorph, {
      targetIdentity,
      depth: 1,
      trigger: "scroll",
      once: true,
      revealed: false,
      hookKey: "",
    });
  } catch {
    world.mutate(goblinId, Polymorph, (r) => {
      r.targetIdentity = targetIdentity;
      r.depth = 1;
      r.revealed = false;
    });
  }

  const spawnedId = resolvePolymorph(world, {
    entityId: goblinId,
    targetIdentity,
    depth: 1,
    actorId: playerId,
    trigger: "scroll",
    reason: "scroll_polymorph",
  });

  assert(spawnedId > 0, "polymorph should succeed");
  assert(!world.isAlive(goblinId), "goblin should be destroyed");
  assertEquals(world.get(spawnedId, NamedIdentity)?.identity, "orc");
  assertEquals(world.get(spawnedId, Position)?.x, 7, "orc should be at goblin's old x");
  assertEquals(world.get(spawnedId, Position)?.y, 5, "orc should be at goblin's old y");
});

Deno.test("scroll polymorph flow: random identity selection uses world.rand", () => {
  clearPolymorphHooks();
  const world = new World({ seed: 77 });
  installPolymorphListener(world);

  const playerId = makePlayer(world, 5, 5);
  const ratId = makeMonster(world, 6, 5, "rat");

  // Simulate random selection (no polymorph_control trait)
  const allIds = listAllMonsterIds();
  assert(allIds.length > 0, "should have monster ids");
  const targetIdentity = allIds[Math.floor(world.rand() * allIds.length)];
  assert(targetIdentity, "random selection should produce an id");
  assert(getMonster(targetIdentity), "random id should map to a valid monster");

  try {
    world.add(ratId, Polymorph, {
      targetIdentity,
      depth: 1,
      trigger: "scroll",
      once: true,
      revealed: false,
      hookKey: "",
    });
  } catch {
    world.mutate(ratId, Polymorph, (r) => {
      r.targetIdentity = targetIdentity;
      r.depth = 1;
      r.revealed = false;
    });
  }

  const spawnedId = resolvePolymorph(world, {
    entityId: ratId,
    targetIdentity,
    depth: 1,
    actorId: playerId,
    trigger: "scroll",
    reason: "scroll_polymorph",
  });

  assert(spawnedId > 0, "polymorph with random identity should succeed");
  assertEquals(world.get(spawnedId, NamedIdentity)?.identity, targetIdentity);
});

// ── polymorph_control trait ──────────────────────────────────────────

Deno.test("polymorph_control trait: player without trait does not have polymorph_control", () => {
  const world = new World({ seed: 20 });
  const playerId = makePlayer(world, 5, 5);

  const traits = world.get(playerId, Traits);
  assertEquals(traits.polymorph_control, false, "default should be false");
});

Deno.test("polymorph_control trait: player with trait has polymorph_control", () => {
  const world = new World({ seed: 21 });
  const playerId = makePlayer(world, 5, 5);

  world.mutate(playerId, Traits, (r) => { r.polymorph_control = true; });

  const traits = world.get(playerId, Traits);
  assertEquals(traits.polymorph_control, true, "should be true after mutation");
});

// ── polymorph:before / polymorph:after events fire correctly ─────────

Deno.test("scroll polymorph emits polymorph:before and polymorph:after events", () => {
  clearPolymorphHooks();
  const world = new World({ seed: 30 });
  installPolymorphListener(world);

  const playerId = makePlayer(world, 5, 5);
  const batId = makeMonster(world, 6, 6, "bat");

  let beforeFired = false;
  let afterFired = false;
  let afterCtx = null;
  world.on("polymorph:before", (ctx) => { beforeFired = true; });
  world.on("polymorph:after", (ctx) => {
    afterFired = true;
    afterCtx = ctx;
  });

  world.add(batId, Polymorph, {
    targetIdentity: "goblin",
    depth: 1,
    trigger: "scroll",
    once: true,
    revealed: false,
    hookKey: "",
  });

  const spawnedId = resolvePolymorph(world, {
    entityId: batId,
    targetIdentity: "goblin",
    depth: 1,
    actorId: playerId,
    trigger: "scroll",
    reason: "scroll_polymorph",
  });

  assert(spawnedId > 0);
  assert(beforeFired, "polymorph:before should fire");
  assert(afterFired, "polymorph:after should fire");
  assertEquals(afterCtx.toEntityId, spawnedId, "after event should contain spawned id");
  assertEquals(afterCtx.targetIdentity, "goblin");
  assertEquals(afterCtx.fromIdentity, "bat");
});

// ── listAllMonsterIds sanity ─────────────────────────────────────────

Deno.test("listAllMonsterIds returns all valid monster ids", () => {
  const allIds = listAllMonsterIds();
  assert(allIds.length >= 10, "should have many monsters");
  for (const id of allIds) {
    const def = getMonster(id);
    assert(def, `getMonster('${id}') should return a definition`);
    assert(def.name, `monster '${id}' should have a name`);
  }
});
