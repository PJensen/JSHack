import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { installInventoryDataProvider } from "../src/main/ui/inventoryDataProvider.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Brain } from "../src/rules/components/Brain.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { Status } from "../src/rules/components/Status.js";
import { addToInventory } from "../src/rules/utils/inventoryFacade.js";
import { clearAll, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";

function makeEquipItem(world, identity, name, slot) {
  const id = world.create();
  world.add(id, NamedIdentity, { identity, name });
  world.add(id, ItemInfo, {
    type: "equip",
    slot,
    weight: 1,
    value: 0,
    description: name,
    count: 1,
    bonuses: {},
    rarity: 1,
    rarityName: "common",
    affixes: [],
  });
  return id;
}

Deno.test("inventory data provider hides equipped gear from bag and exposes character slots", () => {
  const world = new World({ seed: 1234 });
  const player = world.create();
  world.add(player, Player, {});
  world.add(player, Position, { x: 0, y: 0 });
  world.add(player, Inventory, { items: [], capacity: 20 });
  world.add(player, Equipment, {});

  const sword = makeEquipItem(world, "sword_plain", "Plain Sword", "weapon");
  const boots = makeEquipItem(world, "boots_leather", "Leather Boots", "feet");

  addToInventory(world, player, sword);
  addToInventory(world, player, boots);
  const eq = world.get(player, Equipment);
  eq.weapon = sword;

  installInventoryDataProvider({
    world,
    getActiveSpellId: () => null,
    isSimUiBlocked: () => false,
    getMessageLog: () => ({ getEntries: () => [] }),
    tombstoneRepo: { getAll: () => [] },
  });

  /** @type {any} */
  let inventoryPayload = null;
  addEventListener("ui:inventoryData", (ev) => {
    inventoryPayload = ev?.detail || null;
  }, { once: true });
  dispatchEvent(new CustomEvent("ui:requestInventoryData"));

  assert(inventoryPayload, "expected ui:inventoryData payload");
  const bagItems = Array.isArray(inventoryPayload.bagItems) ? inventoryPayload.bagItems : [];
  assert(bagItems.every((it) => Number(it.id || 0) !== sword), "equipped weapon should be hidden from bagItems");
  assert(bagItems.some((it) => Number(it.id || 0) === boots), "unequipped gear should remain in bagItems");
  assertEquals(Number(inventoryPayload?.equippedBySlot?.weapon?.item?.id || 0), sword);

  /** @type {any} */
  let characterPayload = null;
  const onCharacterData = (ev) => {
    characterPayload = ev?.detail || null;
  };
  addEventListener("ui:characterData", onCharacterData);
  dispatchEvent(new CustomEvent("ui:requestCharacterData"));
  removeEventListener("ui:characterData", onCharacterData);

  assert(characterPayload, "expected ui:characterData payload");
  assertEquals(Number(characterPayload?.equippedBySlot?.weapon?.item?.id || 0), sword);
});

Deno.test("inventory data provider does not emit learned spells as bag items", () => {
  const world = new World({ seed: 7 });
  const player = world.create();
  world.add(player, Player, {});
  world.add(player, Position, { x: 0, y: 0 });
  world.add(player, Inventory, { items: [], capacity: 20 });
  world.add(player, Equipment, {});
  world.add(player, Brain, { learnedSpellIds: ["frost"] });

  installInventoryDataProvider({
    world,
    getActiveSpellId: () => "frost",
    isSimUiBlocked: () => false,
    getMessageLog: () => ({ getEntries: () => [] }),
    tombstoneRepo: { getAll: () => [] },
  });

  /** @type {any} */
  let inventoryPayload = null;
  addEventListener("ui:inventoryData", (ev) => {
    inventoryPayload = ev?.detail || null;
  }, { once: true });
  dispatchEvent(new CustomEvent("ui:requestInventoryData"));

  assert(inventoryPayload, "expected ui:inventoryData payload");
  const bagItems = Array.isArray(inventoryPayload.bagItems) ? inventoryPayload.bagItems : [];
  assert(!bagItems.some((it) => String(it?.id || "").startsWith("spell:")), "learned spells should not appear in bagItems");
});

Deno.test("character data dedupes effect/status aliases into one active effect row", () => {
  const world = new World({ seed: 99 });
  const player = world.create();
  world.add(player, Player, {});
  world.add(player, Position, { x: 0, y: 0 });
  world.add(player, Inventory, { items: [], capacity: 20 });
  world.add(player, Equipment, {});
  world.add(player, ActiveEffects, { effects: [{ key: "poison", turnsLeft: 3, potency: 1, stacks: 1 }] });
  world.add(player, Status, { statuses: [{ type: "poisoned", duration: 3, potency: 1, stacks: 1 }] });

  installInventoryDataProvider({
    world,
    getActiveSpellId: () => null,
    isSimUiBlocked: () => false,
    getMessageLog: () => ({ getEntries: () => [] }),
    tombstoneRepo: { getAll: () => [] },
  });

  /** @type {any} */
  let payload = null;
  const onCharacterData = (ev) => {
    payload = ev?.detail || null;
  };
  addEventListener("ui:characterData", onCharacterData);
  dispatchEvent(new CustomEvent("ui:requestCharacterData"));
  removeEventListener("ui:characterData", onCharacterData);

  assert(payload, "expected ui:characterData payload");
  const activeEffects = Array.isArray(payload?.activeEffects) ? payload.activeEffects : [];
  const poisonedRows = activeEffects.filter((entry) => String(entry?.key || "") === "poisoned");
  assertEquals(poisonedRows.length, 1, "poison alias rows should collapse to one canonical poisoned entry");
});

Deno.test("settings data exposes monster ids for spawn autocomplete", () => {
  const world = new World({ seed: 123 });
  const player = world.create();
  world.add(player, Player, {});
  world.add(player, Position, { x: 0, y: 0 });

  installInventoryDataProvider({
    world,
    getActiveSpellId: () => null,
    isSimUiBlocked: () => false,
    getMessageLog: () => ({ getEntries: () => [] }),
    tombstoneRepo: { getAll: () => [] },
  });

  /** @type {any} */
  let payload = null;
  const onSettingsData = (ev) => {
    payload = ev?.detail || null;
  };
  addEventListener("ui:settingsData", onSettingsData);
  dispatchEvent(new CustomEvent("ui:requestSettingsData"));
  removeEventListener("ui:settingsData", onSettingsData);

  assert(payload, "expected ui:settingsData payload");
  const monsterIds = Array.isArray(payload?.allMonsterIds) ? payload.allMonsterIds : [];
  assert(monsterIds.includes("goblin"), "settings autocomplete should include goblin");
  assert(monsterIds.includes("rat"), "settings autocomplete should include rat");
});

Deno.test("settings debug spawn spawns the selected monster near the player", () => {
  clearAll();
  try {
    loadChunk(0, 0, new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR));

    const world = new World({ seed: 321 });
    const player = world.create();
    world.add(player, Player, {});
    world.add(player, Position, { x: 10, y: 10 });

    installInventoryDataProvider({
      world,
      getActiveSpellId: () => null,
      isSimUiBlocked: () => false,
      getMessageLog: () => ({ getEntries: () => [] }),
      tombstoneRepo: { getAll: () => [] },
    });

    dispatchEvent(new CustomEvent("ui:debugSpawnMonster", {
      detail: { monsterId: "goblin" },
    }));

    let spawned = null;
    for (const [id, ident, pos] of world.query(NamedIdentity, Position)) {
      if (id === player) continue;
      if (String(ident?.identity || "") !== "goblin") continue;
      spawned = { id, pos };
      break;
    }

    assert(spawned, "expected goblin to spawn from settings event");
    assertEquals(Math.abs(spawned.pos.x - 10) + Math.abs(spawned.pos.y - 10), 1);
  } finally {
    clearAll();
  }
});
