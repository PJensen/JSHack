import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { Material } from "../src/rules/components/Material.js";
import { MaterialState } from "../src/rules/components/MaterialState.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Position } from "../src/rules/components/Position.js";
import { addToInventory } from "../src/rules/utils/inventoryFacade.js";
import { createItemById } from "../src/rules/utils/itemFactory.js";
import { materialReactionSystem } from "../src/rules/systems/materialReactionSystem.js";

Deno.test("burning paper inventory item is transformed to ash via material stimulus", () => {
  const world = new World({ seed: 1337 });
  const actor = world.create();
  world.add(actor, Inventory, { items: [], maxWeight: 100 });
  world.add(actor, Position, { x: 2, y: 2 });
  world.add(actor, ActiveEffects, {
    effects: [{ key: "burning", potency: 1, turnsLeft: 3, onsetLeft: 0, peakLeft: 0 }],
  });

  const scroll = createItemById(world, "scroll_mapping");
  assert(scroll != null, "scroll should be creatable");
  addToInventory(world, actor, scroll);

  materialReactionSystem(world);

  const ni = world.get(scroll, NamedIdentity);
  assertEquals(String(ni?.identity || ""), "ash");
  const info = world.get(scroll, ItemInfo);
  assertEquals(String(info?.type || ""), "junk");
  const mat = world.get(scroll, Material);
  assertEquals(String(mat?.kind || ""), "sand");
  const mstate = world.get(scroll, MaterialState);
  assert(mstate, "material state should be created by stimulus pipeline before transform");
});
