import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { RunState, DEATH_MODES } from "../src/rules/components/RunState.js";
import { addToInventory, inventoryItems } from "../src/rules/utils/inventoryFacade.js";
import { ensureRunState } from "../src/rules/utils/deathModes.js";
import { dealDamage } from "../src/rules/utils/dealDamage.js";

function makePlayer(world) {
  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 7, y: 9 });
  world.add(player, Vitality, { maxHp: 20, hp: 3 });
  world.add(player, Inventory, { capacity: 99 });
  world.add(player, Equipment, {});

  const dungeon = world.create();
  world.add(dungeon, DungeonState, {
    seed: 1,
    worldSeed: 1,
    currentDepth: 3,
    currentChunkX: 0,
    currentChunkY: 0,
    floorEntityIds: [],
    spawnChunkX: 0,
    spawnChunkY: 0,
  });

  return player;
}

function makeItem(world, identity, type = "misc") {
  const item = world.create();
  world.add(item, ItemInfo, { type, count: 1, weight: 1 });
  world.add(item, NamedIdentity, { identity, name: identity });
  return item;
}

Deno.test("normal death mode resurrects player, drops backpack, and keeps equipped gear", () => {
  const world = new World({ seed: 1 });
  const player = makePlayer(world);
  const sword = makeItem(world, "sword", "weapon");
  const potion = makeItem(world, "potion", "potion");
  addToInventory(world, player, sword, { silent: true });
  addToInventory(world, player, potion, { silent: true });
  world.set(player, Equipment, { ...world.get(player, Equipment), weapon: sword });
  ensureRunState(world, { difficulty: "normal", deathMode: DEATH_MODES.dropBackpack });

  const died = [];
  const resurrected = [];
  const teleports = [];
  world.on("died", (ev) => died.push(ev));
  world.on("player:resurrected", (ev) => resurrected.push(ev));
  world.on("dungeon:teleport-depth", (ev) => teleports.push(ev));

  const result = dealDamage(world, { target: player, amount: 10, source: 0, cause: "test" });

  assertEquals(result.killed, false);
  assertEquals(died.length, 0);
  assertEquals(resurrected.length, 1);
  assertEquals(world.get(player, Vitality).hp, 7);
  assertEquals(world.get(player, Equipment).weapon, sword);
  assert(inventoryItems(world, player).includes(sword), "equipped gear should stay carried");
  assert(!inventoryItems(world, player).includes(potion), "backpack item should drop");
  assertEquals(world.get(potion, Position), { x: 7, y: 9 });
  assertEquals(world.get(resurrected[0].droppedItemIds[0], NamedIdentity).identity, "potion");
  assertEquals(resurrected[0].returnTicket, { depth: 3, x: 7, y: 9 });
  assertEquals(world.get([...world.query(RunState)][0][0], RunState).resurrectionCount, 1);
  assertEquals(teleports[0].source, "resurrection");
  assertEquals(teleports[0].targetDepth, 0);
  assertEquals(teleports[0].returnTicket, { depth: 3, x: 7, y: 9 });
});

Deno.test("hard death mode preserves permadeath", () => {
  const world = new World({ seed: 1 });
  const player = makePlayer(world);
  ensureRunState(world, { difficulty: "hard", deathMode: DEATH_MODES.permadeath });

  const died = [];
  const resurrected = [];
  world.on("died", (ev) => died.push(ev));
  world.on("player:resurrected", (ev) => resurrected.push(ev));

  const result = dealDamage(world, { target: player, amount: 10, source: 0, cause: "test" });

  assertEquals(result.killed, true);
  assertEquals(world.get(player, Vitality).hp, 0);
  assertEquals(died.length, 1);
  assertEquals(resurrected.length, 0);
});

Deno.test("missing run state preserves legacy permadeath", () => {
  const world = new World({ seed: 1 });
  const player = makePlayer(world);

  const died = [];
  const resurrected = [];
  world.on("died", (ev) => died.push(ev));
  world.on("player:resurrected", (ev) => resurrected.push(ev));

  const result = dealDamage(world, { target: player, amount: 10, source: 0, cause: "test" });

  assertEquals(result.killed, true);
  assertEquals(died.length, 1);
  assertEquals(resurrected.length, 0);
});

Deno.test("drop-all-but-one mode drops backpack and extra equipped gear", () => {
  const world = new World({ seed: 1 });
  const player = makePlayer(world);
  const sword = makeItem(world, "sword", "weapon");
  const shield = makeItem(world, "shield", "armor");
  const potion = makeItem(world, "potion", "potion");
  addToInventory(world, player, sword, { silent: true });
  addToInventory(world, player, shield, { silent: true });
  addToInventory(world, player, potion, { silent: true });
  world.set(player, Equipment, { ...world.get(player, Equipment), weapon: sword, offhand: shield });
  ensureRunState(world, { difficulty: "normal", deathMode: DEATH_MODES.dropAllButOne });

  const resurrected = [];
  world.on("player:resurrected", (ev) => resurrected.push(ev));
  dealDamage(world, { target: player, amount: 10, source: 0, cause: "test" });

  assert(inventoryItems(world, player).includes(sword), "preferred weapon should be kept");
  assert(!inventoryItems(world, player).includes(shield), "extra equipped gear should drop");
  assert(!inventoryItems(world, player).includes(potion), "backpack should drop");
  assertEquals(world.get(player, Equipment).weapon, sword);
  assertEquals(world.get(player, Equipment).offhand, null);
  assertEquals(world.get(shield, Position), { x: 7, y: 9 });
  assertEquals(resurrected[0].droppedItemIds.length, 2);
});
