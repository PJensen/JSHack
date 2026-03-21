import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createPlayer } from "../src/rules/archetypes/Player.js";
import { createCorpse } from "../src/rules/archetypes/Food.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { Traits } from "../src/rules/components/Traits.js";
import { Resistances } from "../src/rules/components/Resistences.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { useItemSystem } from "../src/rules/systems/useItemSystem.js";
import { addToInventory } from "../src/rules/utils/inventoryFacade.js";
import { UseIntent } from "../src/rules/components/Intents/UseIntent.js";

function makeCorpse(world, id, name, sizeClass = "M", massKg = 40, tier = 0) {
  return createCorpse(world, { id, name, sizeClass, massKg, tier }, { x: 0, y: 0 });
}

function eatCorpse(world, player, corpse) {
  addToInventory(world, player, corpse);
  world.add(player, UseIntent, { itemId: corpse, targetId: player });
  useItemSystem(world);
}

// ── Diminishing poison resistance (cave_snake) ───────────────────

Deno.test("cave_snake corpse reduces toxMult with diminishing returns", () => {
  const world = new World({ seed: 0xBEEF01 });
  const player = createPlayer(world, { x: 0, y: 0, name: "Hero" });

  const resist = world.get(player, Resistances);
  const before = resist.chemical.toxMult;
  assertEquals(before, 1.0, "should start at 1.0");

  const corpse = makeCorpse(world, "cave_snake", "Cave Snake", "XS", 2);
  eatCorpse(world, player, corpse);

  const after1 = resist.chemical.toxMult;
  assert(after1 < before, "first eat should reduce toxMult");
  assert(after1 > 0.4, "should not reach floor after 1 eat");
  // formula: 0.4 + (1.0 - 0.4) * 0.85 = 0.91
  assertEquals(after1, 0.91, "first eat: floor + (1.0 - floor) * decay");
});

Deno.test("repeated cave_snake eats approach floor with diminishing gains", () => {
  const world = new World({ seed: 0xBEEF02 });
  const player = createPlayer(world, { x: 0, y: 0, name: "Hero" });

  const resist = world.get(player, Resistances);
  const values = [resist.chemical.toxMult];

  for (let i = 0; i < 5; i++) {
    const corpse = makeCorpse(world, "cave_snake", "Cave Snake", "XS", 2);
    eatCorpse(world, player, corpse);
    values.push(resist.chemical.toxMult);
  }

  // Each value should be less than previous
  for (let i = 1; i < values.length; i++) {
    assert(values[i] < values[i - 1], `eat ${i} should reduce toxMult further`);
  }
  // Gains should diminish (gap shrinks)
  const gap1 = values[0] - values[1]; // first eat delta
  const gap5 = values[4] - values[5]; // fifth eat delta
  assert(gap5 < gap1, "later eats should give smaller gains (diminishing returns)");
  // After 5 eats should be well above floor
  assert(values[5] > 0.4, "should not reach floor after 5 eats");
});

Deno.test("cave_snake emits resist-building event with percentage", () => {
  const world = new World({ seed: 0xBEEF03 });
  const player = createPlayer(world, { x: 0, y: 0, name: "Hero" });

  const events = [];
  world.on("corpse:resist-building", (ev) => events.push(ev));

  const corpse = makeCorpse(world, "cave_snake", "Cave Snake", "XS", 2);
  eatCorpse(world, player, corpse);

  assertEquals(events.length, 1, "should emit resist-building event");
  assertEquals(events[0].type, "poison");
  assert(events[0].pct > 0, "should report positive resistance percentage");
});

// ── Snake: poison + diminishing resist ────────────────────────────

Deno.test("snake corpse poisons and builds toxMult resistance", () => {
  const world = new World({ seed: 0xBEEF04 });
  const player = createPlayer(world, { x: 0, y: 0, name: "Hero" });

  const corpse = makeCorpse(world, "snake", "Snake", "XS", 3);
  eatCorpse(world, player, corpse);

  const ae = world.get(player, ActiveEffects);
  assert(ae.effects.some(e => e.key === "poison"), "should apply poison");

  const resist = world.get(player, Resistances);
  assert(resist.chemical.toxMult < 1.0, "should reduce toxMult");
});

// ── Cave bear: bear_vigor buff + diminishing kinetic DR ───────────

Deno.test("cave_bear corpse applies bear_vigor and increases kinetic DR", () => {
  const world = new World({ seed: 0xBEEF05 });
  const player = createPlayer(world, { x: 0, y: 0, name: "Hero" });

  const resist = world.get(player, Resistances);
  const drBefore = resist.kinetic.DR;

  const corpse = makeCorpse(world, "cave_bear", "Cave Bear", "L", 350);
  eatCorpse(world, player, corpse);

  // Bear vigor buff
  const ae = world.get(player, ActiveEffects);
  const vigor = ae.effects.find(e => e.key === "bear_vigor");
  assert(vigor, "should have bear_vigor effect");
  assertEquals(vigor.turnsLeft, 150, "bear_vigor should last 150 turns");

  // Kinetic DR increased
  assert(resist.kinetic.DR > drBefore, "should increase kinetic DR");
  // formula: 4 + 1.5 * max(0, 1 - 4/6) = 4 + 1.5*0.333 = 4.5
  assertEquals(resist.kinetic.DR, 4.5, "first eat: diminished by existing DR");
});

Deno.test("repeated cave_bear eats show diminishing DR gains", () => {
  const world = new World({ seed: 0xBEEF06 });
  const player = createPlayer(world, { x: 0, y: 0, name: "Hero" });

  const resist = world.get(player, Resistances);
  const values = [resist.kinetic.DR];

  for (let i = 0; i < 4; i++) {
    const corpse = makeCorpse(world, "cave_bear", "Cave Bear", "L", 350);
    eatCorpse(world, player, corpse);
    values.push(resist.kinetic.DR);
  }

  // Each should be higher than previous
  for (let i = 1; i < values.length; i++) {
    assert(values[i] > values[i - 1], `eat ${i} should increase DR`);
  }
  // Gains diminish
  const gain1 = values[1] - values[0];
  const gain4 = values[4] - values[3];
  assert(gain4 < gain1, "later eats should give smaller DR gains");
  // Should not exceed ceiling of 6
  assert(values[4] <= 6, "should not exceed ceiling");
});

// ── Floating eye: mindwipe + third_eye trait ──────────────────────

Deno.test("floating_eye corpse applies mindwipe and grants third_eye", () => {
  const world = new World({ seed: 0xBEEF07 });
  const player = createPlayer(world, { x: 0, y: 0, name: "Hero" });

  const traitEvents = [];
  world.on("corpse:trait-gained", (ev) => traitEvents.push(ev));

  const corpse = makeCorpse(world, "floating_eye", "Floating Eye", "M", 40);
  eatCorpse(world, player, corpse);

  const ae = world.get(player, ActiveEffects);
  assert(ae.effects.some(e => e.key === "mindwipe"), "should apply mindwipe");

  const traits = world.get(player, Traits);
  assertEquals(traits.third_eye, true, "should grant third_eye");
  assert(traitEvents.some(e => e.trait === "third_eye"), "should emit third_eye trait event");
});

// ── Dragon: dragonheart + big burn resist nudge (not immunity) ────

Deno.test("dragon corpse grants dragonheart with diminishing burn resist", () => {
  const world = new World({ seed: 0xBEEF08 });
  const player = createPlayer(world, { x: 0, y: 0, name: "Hero" });

  const traitEvents = [];
  world.on("corpse:trait-gained", (ev) => traitEvents.push(ev));

  const resist = world.get(player, Resistances);
  assertEquals(resist.thermal.burnMult, 1.0, "should start at 1.0");

  const startHp = world.get(player, Vitality).hp;
  const corpse = makeCorpse(world, "dragon", "Dragon", "XL", 800, 3);
  eatCorpse(world, player, corpse);

  // Trait
  const traits = world.get(player, Traits);
  assertEquals(traits.dragonheart, true, "should grant dragonheart");
  assert(traitEvents.some(e => e.trait === "dragonheart"), "should emit dragonheart event");

  // Burn resist: big nudge but NOT zero (floor 0.1)
  assert(resist.thermal.burnMult < 0.5, "should dramatically reduce burnMult");
  assert(resist.thermal.burnMult > 0, "should not be zero — diminishing, not immunity");
  // formula: 0.1 + (1.0 - 0.1) * 0.3 = 0.1 + 0.27 = 0.37
  assertEquals(resist.thermal.burnMult, 0.37, "first dragon: floor + headroom * decay");

  // Fire damage
  const endHp = world.get(player, Vitality).hp;
  assert(endHp < startHp, "dragon corpse should deal fire damage");

  const ae = world.get(player, ActiveEffects);
  assert(ae.effects.some(e => e.key === "burn"), "should apply burn effect");
});

// ── Orc: blood rage buff ──────────────────────────────────────────

Deno.test("orc corpse applies blood_rage timed buff", () => {
  const world = new World({ seed: 0xBEEF09 });
  const player = createPlayer(world, { x: 0, y: 0, name: "Hero" });

  const corpse = makeCorpse(world, "orc", "Orc", "M", 95, 1);
  eatCorpse(world, player, corpse);

  const ae = world.get(player, ActiveEffects);
  const rage = ae.effects.find(e => e.key === "blood_rage");
  assert(rage, "should have blood_rage effect");
  assertEquals(rage.turnsLeft, 100, "blood_rage should last 100 turns");
});

// ── Hobgoblin: war_fed buff ───────────────────────────────────────

Deno.test("hobgoblin corpse applies war_fed timed buff", () => {
  const world = new World({ seed: 0xBEEF0A });
  const player = createPlayer(world, { x: 0, y: 0, name: "Hero" });

  const corpse = makeCorpse(world, "hobgoblin", "Hobgoblin", "M", 100, 1);
  eatCorpse(world, player, corpse);

  const ae = world.get(player, ActiveEffects);
  const fed = ae.effects.find(e => e.key === "war_fed");
  assert(fed, "should have war_fed effect");
  assertEquals(fed.turnsLeft, 120, "war_fed should last 120 turns");
  assertEquals(fed.potency, 2, "war_fed potency should be 2");
});

// ── Troll: regeneration + ravenous ────────────────────────────────

Deno.test("troll corpse applies both regeneration and ravenous", () => {
  const world = new World({ seed: 0xBEEF0B });
  const player = createPlayer(world, { x: 0, y: 0, name: "Hero" });

  const corpse = makeCorpse(world, "troll", "Troll", "L", 200, 2);
  eatCorpse(world, player, corpse);

  const ae = world.get(player, ActiveEffects);
  assert(ae.effects.find(e => e.key === "regeneration"), "should have regeneration");
  assert(ae.effects.find(e => e.key === "ravenous"), "should have ravenous debuff");
});

// ── Wight: heal + weakened + deathless progression ────────────────

Deno.test("wight corpse heals and applies weakened debuff", () => {
  const world = new World({ seed: 0xBEEF0C });
  const player = createPlayer(world, { x: 0, y: 0, name: "Hero" });

  const vit = world.get(player, Vitality);
  vit.hp = vit.maxHp - 10;
  const beforeHp = vit.hp;

  const corpse = makeCorpse(world, "wight", "Wight", "M", 60, 1);
  eatCorpse(world, player, corpse);

  assert(vit.hp > beforeHp, "wight corpse should heal the player");

  const ae = world.get(player, ActiveEffects);
  assert(ae.effects.some(e => e.key === "weakened"), "should apply weakened debuff");
});

Deno.test("eating 3 wight corpses grants deathless trait", () => {
  const world = new World({ seed: 0xBEEF0D });
  const player = createPlayer(world, { x: 0, y: 0, name: "Hero" });

  const traitEvents = [];
  world.on("corpse:trait-gained", (ev) => traitEvents.push(ev));

  for (let i = 0; i < 3; i++) {
    const corpse = makeCorpse(world, "wight", "Wight", "M", 60, 1);
    eatCorpse(world, player, corpse);
  }

  const traits = world.get(player, Traits);
  assertEquals(traits.wightCorpsesEaten, 3, "should count 3 wights");
  assertEquals(traits.deathless, true, "should grant deathless");
  assert(traitEvents.some(e => e.trait === "deathless"), "should emit deathless event");
});

// ── Goblin archer: keen_eye buff ──────────────────────────────────

Deno.test("goblin_archer corpse applies keen_eye buff", () => {
  const world = new World({ seed: 0xBEEF0E });
  const player = createPlayer(world, { x: 0, y: 0, name: "Hero" });

  const corpse = makeCorpse(world, "goblin_archer", "Goblin Archer", "S", 30);
  eatCorpse(world, player, corpse);

  const ae = world.get(player, ActiveEffects);
  const keen = ae.effects.find(e => e.key === "keen_eye");
  assert(keen, "should have keen_eye effect");
  assertEquals(keen.turnsLeft, 80, "keen_eye should last 80 turns");
});

// ── Mimic: random effect ──────────────────────────────────────────

Deno.test("mimic corpse applies some effect (gamble)", () => {
  const world = new World({ seed: 0xBEEF0F });
  const player = createPlayer(world, { x: 0, y: 0, name: "Hero" });

  const corpse = makeCorpse(world, "mimic", "Mimic", "M", 140, 99);
  eatCorpse(world, player, corpse);

  const ae = world.get(player, ActiveEffects);
  assert(ae && Array.isArray(ae.effects), "should have active effects");
});

// ── Stone Taunter: gamble stone_skin or stun ──────────────────────

Deno.test("stone_taunter corpse applies stone_skin or stun", () => {
  const world = new World({ seed: 0xBEEF10 });
  const player = createPlayer(world, { x: 0, y: 0, name: "Hero" });

  const corpse = makeCorpse(world, "stone_taunter", "Taunting Statue", "M", 240, 99);
  eatCorpse(world, player, corpse);

  const ae = world.get(player, ActiveEffects);
  const hasStoneSkin = ae.effects.some(e => e.key === "stone_skin");
  const hasStun = ae.effects.some(e => e.key === "stun");
  assert(hasStoneSkin || hasStun, "should apply either stone_skin or stun");
});

// ── EatCallbackContext: grantResistance standalone ─────────────────

Deno.test("EatCallbackContext.grantResistance queues and commits", async () => {
  const { EatCallbackContext } = await import("../src/rules/data/callbacks/eat.js");

  const world = new World({ seed: 0xBEEF11 });
  const player = createPlayer(world, { x: 0, y: 0, name: "Hero" });
  const dummyItemId = world.create();

  const ctx = new EatCallbackContext(world, player, dummyItemId);
  ctx.grantResistance("chemical", "toxMult", 0.5);
  ctx.commit();

  const resist = world.get(player, Resistances);
  assertEquals(resist.chemical.toxMult, 0.5, "should set toxMult to 0.5");
});

// ── EatCallbackContext: heal standalone ────────────────────────────

Deno.test("EatCallbackContext.heal restores HP", async () => {
  const { EatCallbackContext } = await import("../src/rules/data/callbacks/eat.js");

  const world = new World({ seed: 0xBEEF12 });
  const player = createPlayer(world, { x: 0, y: 0, name: "Hero" });
  const dummyItemId = world.create();

  const vit = world.get(player, Vitality);
  vit.hp = vit.maxHp - 10;
  const before = vit.hp;

  const ctx = new EatCallbackContext(world, player, dummyItemId);
  ctx.heal(5);
  ctx.commit();

  assertEquals(vit.hp, before + 5, "should heal 5 HP");
});
