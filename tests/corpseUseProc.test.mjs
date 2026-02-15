import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createPlayer } from "../src/rules/archetypes/Player.js";
import { createCorpse } from "../src/rules/archetypes/Food.js";
import { Inventory } from "../src/rules/components/Inventory.js";
import { UseIntent } from "../src/rules/components/Intents/UseIntent.js";
import { Consumable } from "../src/rules/components/Consumable.js";
import { Resistances } from "../src/rules/components/Resistences.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { useItemSystem } from "../src/rules/systems/useItemSystem.js";
import "../src/rules/scripts/consumables.js";

Deno.test("eating eel corpse grants electric resistance", () => {
  const world = new World({ seed: 0xC0FFEE });
  const player = createPlayer(world, { x: 0, y: 0, name: "Hero" });
  const inv = world.get(player, Inventory);
  assert(inv && Array.isArray(inv.items), "player should have inventory");

  const eelCorpse = createCorpse(world, {
    id: "eel",
    name: "Eel",
    sizeClass: "S",
    massKg: 6,
    tier: 1,
  }, { x: 0, y: 0 });
  const eelConsumable = world.get(eelCorpse, Consumable);
  assertEquals(eelConsumable?.effectParams?.corpseIdentity, "corpse_eel", "corpse identity should follow corpse_<monsterId> convention");
  inv.items.push(eelCorpse);

  const beforeOhms = Number(world.get(player, Resistances)?.electric?.ohms || 0);
  world.add(player, UseIntent, { itemId: eelCorpse, targetId: player });
  useItemSystem(world);

  const afterOhms = Number(world.get(player, Resistances)?.electric?.ohms || 0);
  assert(afterOhms >= 2400, "eel corpse should grant high electric resistance");
  assert(afterOhms >= beforeOhms, "electric resistance should not decrease");
  assertEquals(world.isAlive(eelCorpse), false);
});

Deno.test("eating bat corpse can apply disease effect", () => {
  const world = new World({ seed: 0xA77A77 });
  const player = createPlayer(world, { x: 0, y: 0, name: "Hero" });
  const inv = world.get(player, Inventory);
  assert(inv && Array.isArray(inv.items), "player should have inventory");

  const batCorpse = createCorpse(world, {
    id: "bat",
    name: "Bat",
    sizeClass: "XS",
    massKg: 1,
    tier: 0,
  }, { x: 0, y: 0 });
  inv.items.push(batCorpse);

  world.add(player, UseIntent, { itemId: batCorpse, targetId: player });
  useItemSystem(world);

  const ae = world.get(player, ActiveEffects);
  assert(ae && Array.isArray(ae.effects), "player should gain active effects");
  assert(ae.effects.some((e) => e.key === "disease"), "bat corpse should apply disease");
});
