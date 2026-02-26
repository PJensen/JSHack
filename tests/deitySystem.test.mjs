import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createPlayer } from "../src/rules/archetypes/Player.js";
import { Devotion } from "../src/rules/components/Devotion.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Owner } from "../src/rules/components/Owner.js";
import { Pet } from "../src/rules/components/Pet.js";
import { Status } from "../src/rules/components/Status.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { dealDamage } from "../src/rules/utils/dealDamage.js";
import { deitySystem, getDeityInstance, initDeity } from "../src/rules/systems/deitySystem.js";

Deno.test("deity wrath is applied in rules and emitted on world bus", () => {
  const world = new World({ seed: 0xC0FFEE });
  const playerId = createPlayer(world, { name: "Hero" });
  if (world.has(playerId, Vitality)) world.set(playerId, Vitality, { hp: 100, maxHp: 100 });
  else world.add(playerId, Vitality, { hp: 100, maxHp: 100 });
  if (world.has(playerId, Status)) world.set(playerId, Status, { statuses: [] });
  else world.add(playerId, Status, { statuses: [] });
  if (world.has(playerId, Devotion)) world.set(playerId, Devotion, { deityId: "molkhar" });
  else world.add(playerId, Devotion, { deityId: "molkhar" });

  const deity = initDeity("molkhar", world);
  assert(deity, "deity should initialize");

  const damageEvents = [];
  const wrathEvents = [];
  world.on("damaged", (e) => damageEvents.push(e));
  world.on("deity:wrath", (e) => wrathEvents.push(e));

  deity._emit("wrath", { intensity: 1.0, tick: 100 });

  const vit = world.get(playerId, Vitality);
  const st = world.get(playerId, Status);
  assert(vit.hp < 100, "wrath should reduce hp");
  assert(vit.hp >= 5, "wrath should leave the player alive");
  assert(st.statuses.some((s) => s.type === "weakened"), "wrath should apply weakened");
  assert(st.statuses.some((s) => s.type === "cursed"), "high wrath should apply cursed");

  assertEquals(damageEvents.length, 1, "should emit one damage event");
  assertEquals(wrathEvents.length, 1, "should emit one deity:wrath event");
  assertEquals(wrathEvents[0].playerId, playerId);
  assertEquals(wrathEvents[0].cursed, true);
  assertEquals(wrathEvents[0].deityId, "molkhar");
});

Deno.test("deity demand and utterance are cooldown-gated and forwarded", () => {
  const world = new World({ seed: 0xa77a77 });
  const playerId = createPlayer(world, { name: "Hero" });
  if (world.has(playerId, Devotion)) world.set(playerId, Devotion, { deityId: "molkhar" });
  else world.add(playerId, Devotion, { deityId: "molkhar" });
  const deity = initDeity("molkhar", world);
  assert(deity, "deity should initialize");

  const demandEvents = [];
  const utteranceEvents = [];
  const moodEvents = [];
  world.on("deity:demand", (e) => demandEvents.push(e));
  world.on("deity:utterance", (e) => utteranceEvents.push(e));
  world.on("deity:moodShift", (e) => moodEvents.push(e));

  deity._emit("demand", { tick: 31, intensity: 0.8 });
  deity._emit("demand", { tick: 40, intensity: 0.8 }); // blocked by cooldown
  deity._emit("demand", { tick: 70, intensity: 0.8 }); // allowed

  deity._emit("utterance", { tick: 31, dominant: { dimension: "wrath", value: 0.7 } });
  deity._emit("utterance", { tick: 40, dominant: { dimension: "wrath", value: 0.7 } }); // blocked
  deity._emit("utterance", { tick: 70, dominant: { dimension: "serenity", value: 0.9 } }); // allowed

  deity._emit("moodShift", { to: "wrath" });

  assertEquals(demandEvents.length, 2);
  assertEquals(demandEvents[0].deityId, "molkhar");
  assertEquals(utteranceEvents.length, 2);
  assertEquals(moodEvents.length, 1);
  assertEquals(moodEvents[0].to, "wrath");
});

Deno.test("killing your own pet is a grave deity offense", () => {
  const world = new World({ seed: 0xFA11 });
  const playerId = createPlayer(world, { name: "Hero" });
  if (world.has(playerId, Devotion)) world.set(playerId, Devotion, { deityId: "seraphine" });
  else world.add(playerId, Devotion, { deityId: "seraphine" });

  initDeity("seraphine", world);
  deitySystem(world); // install listeners + baseline tick
  const deity = getDeityInstance("seraphine");
  assert(deity, "deity should initialize");
  const wrathBefore = deity._queryPrecise().wrath;

  const kittyId = world.create();
  world.add(kittyId, Pet);
  world.add(kittyId, Owner, { ownerId: playerId });
  world.add(kittyId, NamedIdentity, { name: "Kitty", identity: "kitty" });
  world.add(kittyId, Vitality, { hp: 1, maxHp: 1 });

  const offenses = [];
  world.on("deity:offense", (ev) => offenses.push(ev));

  const result = dealDamage(world, {
    target: kittyId,
    source: playerId,
    amount: 1,
    type: "physical",
    cause: "test_pet_murder",
    bypassInvuln: true,
    bypassResist: true,
  });
  assert(result.killed, "pet should die from killing blow");

  deitySystem(world); // process added desecration load
  const wrathAfter = deity._queryPrecise().wrath;

  assertEquals(offenses.length, 1, "should emit one deity offense");
  assertEquals(offenses[0].offense, "pet_murder");
  assertEquals(offenses[0].playerId, playerId);
  assert(wrathAfter > wrathBefore, "pet murder should increase wrath");
  assert(wrathAfter >= 0.45, "pet murder should be severe enough to enter danger territory");
});

Deno.test("wrath damage scales from severity and can remove mercy floor", () => {
  const world = new World({ seed: 0x51A1 });
  const playerId = createPlayer(world, { name: "Hero" });
  if (world.has(playerId, Devotion)) world.set(playerId, Devotion, { deityId: "molkhar" });
  else world.add(playerId, Devotion, { deityId: "molkhar" });
  if (world.has(playerId, Vitality)) world.set(playerId, Vitality, { hp: 100, maxHp: 100 });
  else world.add(playerId, Vitality, { hp: 100, maxHp: 100 });
  if (world.has(playerId, Status)) world.set(playerId, Status, { statuses: [] });
  else world.add(playerId, Status, { statuses: [] });

  const deity = initDeity("molkhar", world);
  assert(deity, "deity should initialize");
  deitySystem(world); // install listeners

  const damageEvents = [];
  const wrathEvents = [];
  world.on("damaged", (e) => damageEvents.push(e));
  world.on("deity:wrath", (e) => wrathEvents.push(e));

  deity._emit("wrath", { intensity: 1.0, tick: 100 });
  const baseDamage = Number(damageEvents[0]?.amount || 0);
  assert(baseDamage > 0, "baseline wrath should deal damage");
  assert((world.get(playerId, Vitality)?.hp || 0) > 0, "baseline wrath should keep mercy floor");

  // Reset health/status, then apply a horrifying offense severity payload.
  world.set(playerId, Vitality, { hp: 100, maxHp: 100 });
  world.set(playerId, Status, { statuses: [] });
  world.emit("deity:offense", {
    playerId,
    deityId: "molkhar",
    offense: "pet_corpse_desecration",
    severity: "horrifying",
    desecrateStacks: 48,
  });

  deity._emit("wrath", { intensity: 1.0, tick: 140 });
  const scaledDamage = Number(damageEvents[1]?.amount || 0);
  const vit = world.get(playerId, Vitality);

  assert(scaledDamage > baseDamage, "severity should scale wrath damage above baseline");
  assertEquals(vit?.hp || 0, 0, "horrifying severity should remove mercy floor on high-intensity wrath");
  assertEquals(wrathEvents.length, 2, "should emit both wrath events");
  assert(Number(wrathEvents[1]?.severityScale || 1) > 1, "scaled wrath event should report multiplier");
  assert(Number(wrathEvents[1]?.wrathDebt || 0) > 0, "scaled wrath event should report wrath debt");
});

Deno.test("shrine touch records deity communion on the deity ledger", () => {
  const world = new World({ seed: 0xC0DE });
  const playerId = createPlayer(world, { name: "Hero" });
  if (world.has(playerId, Devotion)) world.set(playerId, Devotion, { deityId: "seraphine" });
  else world.add(playerId, Devotion, { deityId: "seraphine" });

  const deity = initDeity("seraphine", world);
  assert(deity, "deity should initialize");
  deitySystem(world); // install listeners + baseline tick

  const communionEvents = [];
  world.on("shrine:communion", (e) => communionEvents.push(e));

  world.emit("shrine:touch", { actor: playerId, targetId: 321 });
  assertEquals(communionEvents.length, 1);
  assertEquals(communionEvents[0].effect, "blessing");
  assertEquals(communionEvents[0].deityId, "seraphine");
  assertEquals(deity.ledger.ticksSinceLast("pray"), 0, "shrine should register an immediate prayer");
  assertEquals(deity.ledger.ticksSinceLast("offer"), 0, "shrine should register an immediate offering");
});

Deno.test("shrine touch is cooldown-gated to prevent spam", () => {
  const world = new World({ seed: 0x5A11 });
  const playerId = createPlayer(world, { name: "Hero" });
  if (world.has(playerId, Devotion)) world.set(playerId, Devotion, { deityId: "seraphine" });
  else world.add(playerId, Devotion, { deityId: "seraphine" });

  initDeity("seraphine", world);
  deitySystem(world); // install listeners

  const communionEvents = [];
  world.on("shrine:communion", (e) => communionEvents.push(e));

  world.emit("shrine:touch", { actor: playerId, targetId: 900 });
  world.emit("shrine:touch", { actor: playerId, targetId: 900 });

  assertEquals(communionEvents.length, 2, "both shrine touches should emit outcome events");
  assertEquals(communionEvents[0].effect, "blessing");
  assertEquals(communionEvents[1].effect, "cooldown");
  assert(Number(communionEvents[1].cooldownRemaining || 0) > 0, "cooldown event should report remaining turns");
});
