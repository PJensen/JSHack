import "./helpers/installContentCatalog.mjs";
import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { DoorKey } from "../src/rules/components/DoorKey.js";
import { DungeonEntrance } from "../src/rules/components/DungeonEntrance.js";
import { InteractIntent } from "../src/rules/components/Intents/InteractIntent.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { Position } from "../src/rules/components/Position.js";
import { RAT_CELLAR_LOCK_ID } from "../src/rules/data/questLocks.js";
import { getUnderworldRegionTemplate } from "../src/rules/environment/dungeon/underworldRegions.js";
import { canTraverseDungeonEntrance, createTransitionController } from "../src/main/wiring/transitionWiring.js";
import { addToInventory } from "../src/rules/utils/inventoryFacade.js";
import { createItemById } from "../src/rules/utils/itemFactory.js";
import { interactionSystem } from "../src/rules/systems/interactionSystem.js";
import { Interactable } from "../src/rules/components/Interactable.js";
import { LockpickPrompted } from "../src/events/LockpickPrompted.js";
import { LockpickResolved } from "../src/events/LockpickResolved.js";

function ratCellarEntrance(overrides = {}) {
  const template = getUnderworldRegionTemplate("tavern_basement");
  return {
    templateId: template.id,
    label: template.label,
    type: template.type,
    floors: template.floors,
    biome: template.biome,
    monsterTier: template.monsterTier,
    lootTier: template.lootTier,
    questId: template.questId,
    lockId: template.lockId,
    lockDifficulty: template.lockDifficulty,
    targetDepth: 1,
    anchorX: 0,
    anchorY: 0,
    ...overrides,
  };
}

Deno.test("rat cellar is a very-hard keyed gate", () => {
  const entrance = getUnderworldRegionTemplate("tavern_basement");
  assertEquals(entrance.lockId, RAT_CELLAR_LOCK_ID);
  assertEquals(entrance.lockDifficulty, "very_hard");

  const world = new World({ seed: 3 });
  const player = world.create();
  world.add(player, Inventory, { capacity: 4 });
  assertEquals(canTraverseDungeonEntrance(world, player, entrance), false);

  const key = world.create();
  world.add(key, ItemInfo, { type: "tool", weight: 0.1, value: 0, description: "test", count: 1 });
  world.add(key, DoorKey, { lockId: RAT_CELLAR_LOCK_ID });
  addToInventory(world, player, key);
  assertEquals(canTraverseDungeonEntrance(world, player, entrance), true);
});

Deno.test("locked dungeon entrance reports the lock and opens lockpicking on descend", () => {
  const world = new World({ seed: 4 });
  const player = world.create();
  world.add(player, Position, { x: 3, y: 4 });
  world.add(player, Inventory, { capacity: 4 });
  const lockpick = createItemById(world, "lockpick", { count: 1 });
  addToInventory(world, player, lockpick);

  const stair = world.create();
  world.add(stair, Position, { x: 3, y: 4 });
  world.add(stair, Interactable, { action: "descendStair", params: null });
  world.add(stair, DungeonEntrance, ratCellarEntrance({ anchorX: 3, anchorY: 4 }));

  const messages = [];
  const prompts = [];
  world.on("message", (event) => messages.push(event));
  world.on(LockpickPrompted, (event) => prompts.push(event));
  const controller = createTransitionController({
    world,
    playerEntity: () => ({ id: player, pos: world.get(player, Position) }),
    tombstoneRepo: null,
    onTransitioned() {},
  });
  controller.install();

  world.emit("stair:traverse", { actor: player, targetId: stair, direction: "down" });

  assertEquals(messages.at(-1)?.type, "system");
  assertEquals(messages.at(-1)?.text, "The dungeon entrance is locked.");
  assertEquals(prompts.length, 1);
  assertEquals(prompts[0].targetId, stair);
  assertEquals(prompts[0].difficulty, "very_hard");
});

Deno.test("successful entrance lockpick consumes a pick and persists the unlocked gate", () => {
  const world = new World({ seed: 5 });
  const player = world.create();
  world.add(player, Inventory, { capacity: 4 });
  const lockpick = createItemById(world, "lockpick", { count: 1 });
  addToInventory(world, player, lockpick);
  const stair = world.create();
  world.add(stair, Interactable, { action: "descendStair", params: null });
  world.add(stair, DungeonEntrance, ratCellarEntrance());

  const resolved = [];
  world.on(LockpickResolved, (event) => resolved.push(event));
  world.add(player, InteractIntent, { targetId: stair, mode: "lockpickResult", success: true });
  interactionSystem(world);

  assertEquals(resolved.length, 1);
  assertEquals(resolved[0].success, true);
  assertEquals(world.get(stair, DungeonEntrance)?.lockId, "");
  assertEquals(canTraverseDungeonEntrance(world, player, world.get(stair, DungeonEntrance)), true);
});
