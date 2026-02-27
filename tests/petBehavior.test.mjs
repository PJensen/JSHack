import { assert } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { petBehaviorSystem } from "../src/rules/systems/petBehaviorSystem.js";
import { Player } from "../src/rules/components/Player.js";
import { Pet } from "../src/rules/components/Pet.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { MoveIntent } from "../src/rules/components/Intents/MoveIntent.js";
import { PetState } from "../src/rules/components/PetState.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { Consumable } from "../src/rules/components/Consumable.js";
import { FoodDecay } from "../src/rules/components/FoodDecay.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";

function addCorpse(world, { x, y, name, identity, nutrition = 300, turnsHeld = 0, shelfLife = 150 }) {
  const corpseId = world.create();
  world.add(corpseId, Position, { x, y });
  world.add(corpseId, NamedIdentity, { name, identity });
  world.add(corpseId, ItemInfo, {
    type: "food",
    weight: 2,
    value: 1,
    description: "corpse",
    count: 1,
  });
  world.add(corpseId, Consumable, {
    effectParams: { nutrition, corpseIdentity: identity },
    remainingUses: 1,
    potency: 0,
  });
  world.add(corpseId, FoodDecay, { turnsHeld, shelfLife });
  return corpseId;
}

Deno.test("pet behavior ignores dead pet corpses", () => {
  const world = new World({ seed: 42 });

  const playerId = world.create();
  world.add(playerId, Player, {});
  world.add(playerId, Position, { x: 10, y: 10 });

  const corpseId = world.create();
  world.add(corpseId, Pet);
  world.add(corpseId, Position, { x: 0, y: 0 });
  world.add(corpseId, Vitality, { hp: 0, maxHp: 5 });

  petBehaviorSystem(world);

  assert(!world.has(corpseId, MoveIntent), "dead pet corpse should not receive MoveIntent");
  assert(!world.has(corpseId, PetState), "dead pet corpse should not enter pet AI states");
  const pos = world.get(corpseId, Position);
  assert(pos && pos.x === 0 && pos.y === 0, "dead pet corpse should not move");
});

Deno.test("kitty munches basic corpse underfoot, heals, and leaves a half-eaten corpse", () => {
  const world = new World({ seed: 42 });

  const playerId = world.create();
  world.add(playerId, Player, {});
  world.add(playerId, Position, { x: 10, y: 10 });

  const kittyId = world.create();
  world.add(kittyId, Pet);
  world.add(kittyId, Position, { x: 1, y: 1 });
  world.add(kittyId, Vitality, { hp: 5, maxHp: 10 });
  world.add(kittyId, NamedIdentity, { name: "Kitty", identity: "kitty" });

  const corpseId = addCorpse(world, {
    x: 1,
    y: 1,
    name: "Orc Corpse",
    identity: "corpse_orc",
    nutrition: 300,
  });

  const munchEvents = [];
  world.on("pet:corpse-munch", (ev) => munchEvents.push(ev));

  petBehaviorSystem(world);

  assert(world.isAlive(corpseId), "corpse should remain after first munch");
  assert(world.get(kittyId, Vitality).hp > 5, "kitty should heal");
  assert(world.get(corpseId, Consumable).effectParams.nutrition === 150, "nutrition should be reduced after partial munch");
  assert(world.get(corpseId, NamedIdentity).name.startsWith("Half-eaten "), "corpse should be marked as half-eaten");
  assert(!world.has(kittyId, MoveIntent), "munching should consume pet action for this tick");

  assert(munchEvents.length === 1, "expected one pet:corpse-munch event");
  assert(munchEvents[0].partial === true, "event should report partial corpse consumption");
  assert(munchEvents[0].heal > 0, "event should include healing amount");
});

Deno.test("kitty can munch special-effect corpses", () => {
  const world = new World({ seed: 42 });

  const playerId = world.create();
  world.add(playerId, Player, {});
  world.add(playerId, Position, { x: 10, y: 10 });

  const kittyId = world.create();
  world.add(kittyId, Pet);
  world.add(kittyId, Position, { x: 2, y: 2 });
  world.add(kittyId, Vitality, { hp: 5, maxHp: 10 });
  world.add(kittyId, NamedIdentity, { name: "Kitty", identity: "kitty" });

  const corpseId = addCorpse(world, {
    x: 2,
    y: 2,
    name: "Snake Corpse",
    identity: "corpse_snake",
    nutrition: 150,
  });

  petBehaviorSystem(world);

  assert(world.isAlive(corpseId), "corpse should remain after first munch");
  assert(world.get(kittyId, Vitality).hp > 5, "kitty should heal from special corpse munch");
  assert(world.get(corpseId, Consumable).effectParams.nutrition === 75, "nutrition should be reduced after munch");
});

Deno.test("pet only munches corpses below 75% HP", () => {
  const world = new World({ seed: 42 });

  const playerId = world.create();
  world.add(playerId, Player, {});
  world.add(playerId, Position, { x: 10, y: 10 });

  const kittyId = world.create();
  world.add(kittyId, Pet);
  world.add(kittyId, Position, { x: 3, y: 3 });
  world.add(kittyId, Vitality, { hp: 8, maxHp: 10 });
  world.add(kittyId, NamedIdentity, { name: "Kitty", identity: "kitty" });

  const corpseId = addCorpse(world, {
    x: 3,
    y: 3,
    name: "Orc Corpse",
    identity: "corpse_orc",
    nutrition: 300,
  });

  petBehaviorSystem(world);

  assert(world.get(kittyId, Vitality).hp === 8, "healthy kitty should not munch");
  assert(world.get(corpseId, Consumable).effectParams.nutrition === 300, "corpse should remain untouched above threshold");
});

Deno.test("feline has strong toxic resistance when munching decayed corpses", () => {
  const world = new World({ seed: 42 });
  world.rand = () => 0.2;

  const playerId = world.create();
  world.add(playerId, Player, {});
  world.add(playerId, Position, { x: 10, y: 10 });

  const kittyId = world.create();
  world.add(kittyId, Pet);
  world.add(kittyId, Position, { x: 1, y: 1 });
  world.add(kittyId, Vitality, { hp: 5, maxHp: 10 });
  world.add(kittyId, NamedIdentity, { name: "Kitty", identity: "kitty" });

  const wolfId = world.create();
  world.add(wolfId, Pet);
  world.add(wolfId, Position, { x: 2, y: 2 });
  world.add(wolfId, Vitality, { hp: 5, maxHp: 10 });
  world.add(wolfId, NamedIdentity, { name: "Wolf", identity: "wolf_pet" });

  addCorpse(world, {
    x: 1,
    y: 1,
    name: "Orc Corpse",
    identity: "corpse_orc",
    nutrition: 300,
    turnsHeld: 200,
    shelfLife: 150,
  });
  addCorpse(world, {
    x: 2,
    y: 2,
    name: "Orc Corpse",
    identity: "corpse_orc",
    nutrition: 300,
    turnsHeld: 200,
    shelfLife: 150,
  });

  petBehaviorSystem(world);

  const kittyEffects = world.get(kittyId, ActiveEffects)?.effects || [];
  const wolfEffects = world.get(wolfId, ActiveEffects)?.effects || [];
  const kittyDiseased = kittyEffects.some((e) => String(e?.key || "") === "disease");
  const wolfDiseased = wolfEffects.some((e) => String(e?.key || "") === "disease");

  assert(kittyDiseased === false, "kitty should resist most decay toxin procs");
  assert(wolfDiseased === true, "non-feline pet should still suffer decay toxin");
});
