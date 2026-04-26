import { assert } from "jsr:@std/assert";
import { assertAlmostEquals } from "jsr:@std/assert";
import {
  CHANNELING_LOOP_OPTIONS,
  CHANNELING_LOOP_SOUND_ID,
  DUNGEON_LOOP_OPTIONS,
  DUNGEON_LOOP_SOUND_ID,
  DEATH_SOUND_BY_IDENTITY,
  FAMILIAR_FIRE_CAST_SOUND_ID,
  FAMILIAR_FIRE_READY_SOUND_ID,
  FOOD_EAT_SOUND_ID,
  PUSH_STONE_SOUND_ID,
  SPELL_CAST_SOUND_EVENTS,
  TRAP_SOUND_BY_TYPE,
  WEAPON_RACK_DROPPED_SOUND_ID,
  computeZoomAudibilityGain,
  resolveAudioPlayKey,
  resolveStatusSoundId,
  shouldPlayElectrocutionSound,
  shouldPlayDungeonOmen,
  shouldPlayTeleportSound,
} from "../src/display/audio/audioWiring.js";

Deno.test("audio wiring includes spider spell cast events", () => {
  assert(SPELL_CAST_SOUND_EVENTS.includes("spell:web_spit"));
  assert(SPELL_CAST_SOUND_EVENTS.includes("spell:spider_lunge"));
});

Deno.test("audio wiring exposes a clean channeling loop contract", () => {
  assert(CHANNELING_LOOP_SOUND_ID === "spell:channeling");
  assert(CHANNELING_LOOP_OPTIONS.bus === "spells");
  assert(CHANNELING_LOOP_OPTIONS.crossfade > 0);
  assert(CHANNELING_LOOP_OPTIONS.fadeOut > 0);
});

Deno.test("audio wiring exposes a persistent dungeon loop contract", () => {
  assert(DUNGEON_LOOP_SOUND_ID === "ambient:dungeon");
  assert(DUNGEON_LOOP_OPTIONS.bus === "ambient:loop");
  assert(DUNGEON_LOOP_OPTIONS.volume > 0);
  assert(DUNGEON_LOOP_OPTIONS.crossfade > 0);
  assert(DUNGEON_LOOP_OPTIONS.fadeOut > 0);
});

Deno.test("audio wiring exposes familiar fire ready and cast sound aliases", () => {
  assert(FAMILIAR_FIRE_READY_SOUND_ID === "torch:ignite");
  assert(FAMILIAR_FIRE_CAST_SOUND_ID === "spell:fireball");
});

Deno.test("audio wiring exposes food and stone push sound aliases", () => {
  assert(FOOD_EAT_SOUND_ID === "item:consume:food");
  assert(PUSH_STONE_SOUND_ID === "action:move_boulder");
});

Deno.test("audio wiring maps new authored event sounds", () => {
  assert(DEATH_SOUND_BY_IDENTITY.skeleton === "creature:skeleton:died");
  assert(DEATH_SOUND_BY_IDENTITY.skeleton_archer === "creature:skeleton:died");
  assert(DEATH_SOUND_BY_IDENTITY.skeleton_sharpshooter === "creature:skeleton:died");
  assert(TRAP_SOUND_BY_TYPE.snake === "trap:snake");
  assert(TRAP_SOUND_BY_TYPE.spike === "trap:spike");
  assert(WEAPON_RACK_DROPPED_SOUND_ID === "rack:weapon:dropped");
});

Deno.test("audio wiring zoom gain follows camera scale with clamps", () => {
  assertAlmostEquals(computeZoomAudibilityGain(64, 64), 1, 1e-10);
  assertAlmostEquals(computeZoomAudibilityGain(16, 64), 0.65, 1e-10);
  assertAlmostEquals(computeZoomAudibilityGain(256, 64), 1.35, 1e-10);
  assertAlmostEquals(computeZoomAudibilityGain(81, 64), 1.125, 1e-10);
});

Deno.test("audio wiring accepts all authored generic audio payload keys", () => {
  assert(resolveAudioPlayKey({ key: "shop:enter" }) === "shop:enter");
  assert(resolveAudioPlayKey({ id: "holy_chime" }) === "holy_chime");
  assert(resolveAudioPlayKey({ sound: "status:frozen" }) === "status:frozen");
});

Deno.test("audio wiring maps semantic status events to status sounds", () => {
  assert(resolveStatusSoundId({ kind: "frozen" }) === "status:frozen");
  assert(resolveStatusSoundId({ effect: "slimed" }) === "status:slimed");
  assert(resolveStatusSoundId({ status: "deafened" }) === "status:deafened");
  assert(resolveStatusSoundId({ type: "electrocuted" }) === "status:electrocuted");
});

Deno.test("audio wiring plays electrocution for non-spell electric damage", () => {
  assert(shouldPlayElectrocutionSound({ type: "electric", cause: "grid_bug" }));
  assert(shouldPlayElectrocutionSound({ type: "lightning", cause: "trap" }));
  assert(!shouldPlayElectrocutionSound({ type: "fire", cause: "spell" }));
});

Deno.test("audio wiring keeps housekeeping teleports silent", () => {
  const isPlayer = (id) => id === 7;

  assert(shouldPlayTeleportSound({ id: 7, source: "scroll:teleportation" }, isPlayer));
  assert(!shouldPlayTeleportSound({ id: 7, source: "dungeon:teleport-depth" }, isPlayer));
  assert(!shouldPlayTeleportSound({ id: 8, source: "scroll:teleportation" }, isPlayer));
});

Deno.test("audio wiring gates dungeon omens to rare real dungeon events", () => {
  assert(!shouldPlayDungeonOmen({ kind: "fire", at: { x: 1, y: 2 } }, {}, 0));
  assert(!shouldPlayDungeonOmen({ kind: "fire" }, {}, 1));

  const state = {};
  let played = 0;
  for (let i = 0; i < 240; i++) {
    if (shouldPlayDungeonOmen({
      kind: "fire",
      medium: "floor",
      cause: "spell:fireball",
      sourceKind: "player",
      at: { x: i, y: 7 },
    }, state, 1)) {
      played++;
    }
  }

  assert(played > 0, "real dungeon events should occasionally produce an omen");
  assert(played < 20, "omens should stay rare even during many hazard events");
});
