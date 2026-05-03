import "./helpers/installContentMonsters.mjs";
// Mimic: ambush predator with disguise, adhesive grip stun onHit.

import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { getMonster } from "../src/rules/data/monsters.js";
import { resolvePolymorph, clearPolymorphHooks } from "../src/rules/systems/polymorphSystem.js";
import { Polymorph } from "../src/rules/components/Polymorph.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { Collider } from "../src/rules/components/Collider.js";
import { Interactable } from "../src/rules/components/Interactable.js";
import { clearAll, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";

function makeWorld(seed = 1) {
  clearAll();
  clearPolymorphHooks();
  loadChunk(0, 0, new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR));
  return new World({ seed });
}

function placeMimicChest(world, x, y, depth = 1) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, NamedIdentity, { name: "Chest", identity: "chest" });
  world.add(id, Collider, { solid: true, blocksSight: false });
  world.add(id, Interactable, { action: "touchMimic", params: null });
  world.add(id, Inventory, { capacity: 20 });
  world.add(id, Polymorph, {
    targetIdentity: "mimic",
    trigger: "touch",
    once: true,
    revealed: false,
    hookKey: "mimic_touch",
    depth,
  });
  return id;
}

Deno.test("mimic: definition has adhesive grip stun onHit", () => {
  const def = getMonster("mimic");
  assert(def, "mimic should exist");
  assert(def.hooks?.onHit?.length > 0, "mimic should have onHit hooks");
  assert(def.specials.includes("Adhesive grip (stun 30%)"), "specials should mention stun");
});

Deno.test("mimic: polymorph transforms chest into mimic monster", () => {
  const world = makeWorld(1);
  const chestId = placeMimicChest(world, 5, 5, 3);

  const events = [];
  world.on("mimic:revealed", (e) => events.push(e));

  const monsterId = resolvePolymorph(world, {
    entityId: chestId,
    actorId: 0,
    trigger: "touch",
    reason: "mimic_touched",
  });

  assert(monsterId > 0, "polymorph should produce a new entity");
  assert(!world.isAlive(chestId), "original chest should be destroyed");

  const ni = world.get(monsterId, NamedIdentity);
  assertEquals(ni.identity, "mimic", "new entity should be a mimic");

  const vit = world.get(monsterId, Vitality);
  assert(vit && vit.hp > 0, "mimic should have HP");

  assertEquals(events.length, 1, "should emit mimic:revealed event");
});

Deno.test("mimic: disguised as barrel still transforms correctly", () => {
  const world = makeWorld(2);
  const id = world.create();
  world.add(id, Position, { x: 3, y: 3 });
  world.add(id, NamedIdentity, { name: "Barrel", identity: "barrel" });
  world.add(id, Collider, { solid: true, blocksSight: false });
  world.add(id, Interactable, { action: "touchMimic", params: null });
  world.add(id, Polymorph, {
    targetIdentity: "mimic",
    trigger: "touch",
    once: true,
    revealed: false,
    hookKey: "mimic_touch",
    depth: 2,
  });

  const events = [];
  world.on("mimic:revealed", (e) => events.push(e));

  const monsterId = resolvePolymorph(world, {
    entityId: id,
    actorId: 0,
    trigger: "touch",
    reason: "mimic_touched",
  });

  assert(monsterId > 0, "should transform");
  const ni = world.get(monsterId, NamedIdentity);
  assertEquals(ni.identity, "mimic");
  assertEquals(events.length, 1);
  assertEquals(events[0].fromIdentity, "barrel");
});
