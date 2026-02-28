import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { installInventoryDataProvider } from "../src/main/ui/inventoryDataProvider.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { Brain } from "../src/rules/components/Brain.js";

Deno.test("character data includes active spell tooltip metadata", () => {
  const world = new World({ seed: 4242 });
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
  let characterPayload = null;
  addEventListener("ui:characterData", (ev) => {
    characterPayload = ev?.detail || null;
  }, { once: true });
  dispatchEvent(new CustomEvent("ui:requestCharacterData"));

  assert(characterPayload, "expected ui:characterData payload");
  const activeSpell = characterPayload?.equippedBySlot?.brain?.item;
  assert(activeSpell, "brain slot should contain active spell");
  assertEquals(String(activeSpell.id), "spell:frost");
  assert(Array.isArray(activeSpell.detailLines) && activeSpell.detailLines.length > 0, "active spell should include detail lines");
  assert(Array.isArray(activeSpell.targetEffects) && activeSpell.targetEffects.length > 0, "active spell should include target effects");
});
