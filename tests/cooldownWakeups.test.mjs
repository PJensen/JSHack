import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { ItemCooldown } from "../src/rules/components/ItemCooldown.js";
import { spellCooldownSystem } from "../src/rules/systems/spellCooldownSystem.js";
import { itemCooldownSystem } from "../src/rules/systems/itemCooldownSystem.js";
import { getSpellCooldown, setSpellCooldown } from "../src/rules/utils/spellCooldowns.js";
import { getItemCooldown, setItemCooldown } from "../src/rules/utils/itemCooldowns.js";

Deno.test("spell cooldowns: computed from dueTurn and expire on wakeup", () => {
  const world = new World({ seed: 123 });
  world.setScheduler(() => {});
  setSpellCooldown(world, "lightning", 3, 3);

  assertEquals(getSpellCooldown(world, "lightning")?.remaining, 3);
  world.tick(1);
  assertEquals(getSpellCooldown(world, "lightning")?.remaining, 2);
  world.tick(1);
  assertEquals(getSpellCooldown(world, "lightning")?.remaining, 1);
  world.tick(1);
  spellCooldownSystem(world);
  assertEquals(getSpellCooldown(world, "lightning"), null);
});

Deno.test("item cooldowns: due-turn wakeup zeroes remaining", () => {
  const world = new World({ seed: 456 });
  world.setScheduler(() => {});
  const itemId = world.create();
  world.add(itemId, ItemCooldown, { turnsRemaining: 0, turnsMax: 0, dueTurn: 0 });

  setItemCooldown(world, itemId, 4);
  assertEquals(getItemCooldown(world, itemId)?.remaining, 4);
  world.tick(1);
  world.tick(1);
  assertEquals(getItemCooldown(world, itemId)?.remaining, 2);
  world.tick(1);
  world.tick(1);
  itemCooldownSystem(world);
  assertEquals(getItemCooldown(world, itemId)?.remaining, 0);
});
