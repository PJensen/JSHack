import "./helpers/installContentCatalog.mjs";
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { urnBreakRule, sarcophagusOpenRule } from "../src/content/interactables/crypt/index.js";
import { executeVerbRule } from "../src/rules/kernel/verbRule.js";
import { runInteractHooks } from "../src/rules/interaction/interactRunner.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Collider } from "../src/rules/components/Collider.js";
import { Interactable } from "../src/rules/components/Interactable.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { UrnInteractionResolved } from "../src/events/UrnInteractionResolved.js";
import { SarcophagusInteractionResolved } from "../src/events/SarcophagusInteractionResolved.js";
import { inventoryItems } from "../src/rules/utils/inventoryFacade.js";
import { clearAll, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";

function loadFloor() {
  clearAll();
  loadChunk(0, 0, new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR));
}

function makeActor(world, x = 5, y = 5) {
  const actor = world.create();
  world.add(actor, Position, { x, y });
  world.add(actor, Vitality, { maxHp: 40, hp: 40 });
  return actor;
}

function makeTarget(world, identity, x = 6, y = 5) {
  const target = world.create();
  world.add(target, Position, { x, y });
  world.add(target, NamedIdentity, { name: identity, identity });
  world.add(target, Collider, { solid: true, blocksSight: false });
  return target;
}

function identities(world) {
  return [...world.query(NamedIdentity)].map(([, ni]) => String(ni.identity || ""));
}

Deno.test("urn authored rule: spectral snake outcome destroys urn and spawns nearby", () => {
  loadFloor();
  const world = new World({ seed: 11 });
  world.step = 3;
  const actor = makeActor(world);
  const urn = makeTarget(world, "urn");
  const events = [];
  world.on(UrnInteractionResolved, (event) => events.push(event));

  const result = executeVerbRule(world, urnBreakRule, {
    actor,
    primary: urn,
    target: urn,
    params: { forceOutcomeId: "spectral-snake" },
  });

  assertEquals(result.ok, true);
  assertEquals(result.payload.outcomeId, "spectral-snake");
  assertEquals(world.isAlive(urn), false);
  assert(identities(world).includes("ashes"), "broken urn should scatter ashes");
  assert(identities(world).includes("spectral_snake"), "spectral snake should spawn");
  assertEquals(events[0]?.outcome, "spectral-snake");
  assertEquals(events[0]?.spawnedName, "Spectral Snake");
});

Deno.test("urn authored rule: shard trap damages actor and still destroys urn", () => {
  loadFloor();
  const world = new World({ seed: 12 });
  world.step = 4;
  const actor = makeActor(world);
  const urn = makeTarget(world, "urn");
  const events = [];
  world.on(UrnInteractionResolved, (event) => events.push(event));

  executeVerbRule(world, urnBreakRule, {
    actor,
    primary: urn,
    target: urn,
    params: { forceOutcomeId: "shard-trap" },
  });

  assertEquals(world.isAlive(urn), false);
  assert(world.get(actor, Vitality).hp < 40, "trap should damage actor");
  assert(events[0]?.damage > 0, "event should report trap damage");
});

Deno.test("sarcophagus authored rule: skeleton outcome opens once and spawns off the sarcophagus tile", () => {
  loadFloor();
  const world = new World({ seed: 13 });
  world.step = 5;
  const actor = makeActor(world);
  const sarc = makeTarget(world, "sarcophagus");
  world.add(sarc, Interactable, { action: "openSarcophagus", params: { depth: 3 } });
  const events = [];
  world.on(SarcophagusInteractionResolved, (event) => events.push(event));

  executeVerbRule(world, sarcophagusOpenRule, {
    actor,
    primary: sarc,
    target: sarc,
    params: { interactableParams: { depth: 3 }, forceOutcomeId: "skeleton" },
  });

  assertEquals(world.has(sarc, Interactable), false);
  assertEquals(world.get(sarc, Collider)?.solid, false);
  assert(world.has(sarc, Inventory), "opened sarcophagus should become a container");
  const spawned = [...world.query(NamedIdentity, Position)].find(([, ni]) =>
    ["skeleton", "skeleton_archer"].includes(String(ni.identity || ""))
  );
  assert(spawned, "skeleton-family monster should spawn");
  const [, , pos] = spawned;
  assert(pos.x !== 6 || pos.y !== 5, "spawn should not be on sarcophagus tile");
  assert(pos.x !== 5 || pos.y !== 5, "spawn should not be on actor tile");
  assertEquals(events[0]?.outcome, "skeleton");
});

Deno.test("sarcophagus authored rule: burial loot stocks inventory and removes interactivity", () => {
  loadFloor();
  const world = new World({ seed: 14 });
  world.step = 6;
  const actor = makeActor(world);
  const sarc = makeTarget(world, "sarcophagus");
  world.add(sarc, Interactable, { action: "openSarcophagus", params: { depth: 5 } });
  const events = [];
  world.on(SarcophagusInteractionResolved, (event) => events.push(event));

  executeVerbRule(world, sarcophagusOpenRule, {
    actor,
    primary: sarc,
    target: sarc,
    params: { interactableParams: { depth: 5 }, forceOutcomeId: "burial-loot" },
  });

  assertEquals(world.has(sarc, Interactable), false);
  assert(world.has(sarc, Inventory), "sarcophagus should have inventory");
  assert(inventoryItems(world, sarc).length >= 2, "burial loot should be stocked inside");
  assertEquals(events[0]?.outcome, "burial-loot");
  assert(events[0]?.lootCount >= 2, "event should report loot count");
});

Deno.test("authored runner passes static interactable params into crypt rules", () => {
  loadFloor();
  const world = new World({ seed: 15 });
  world.step = 7;
  const actor = makeActor(world);
  const sarc = makeTarget(world, "sarcophagus");
  const events = [];
  world.on(SarcophagusInteractionResolved, (event) => events.push(event));

  const handled = runInteractHooks(
    "openSarcophagus",
    world,
    actor,
    sarc,
    { depth: 9 },
    { mode: "open", forceOutcomeId: "empty" },
  );

  assertEquals(handled, true);
  assertEquals(events[0]?.depth, 9);
});
