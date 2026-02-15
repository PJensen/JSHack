import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createPlayer } from "../src/rules/archetypes/Player.js";
import { Devotion } from "../src/rules/components/Devotion.js";
import { Status } from "../src/rules/components/Status.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { initDeity } from "../src/rules/systems/deitySystem.js";

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
