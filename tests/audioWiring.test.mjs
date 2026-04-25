import { assert } from "jsr:@std/assert";
import { assertAlmostEquals } from "jsr:@std/assert";
import {
  CHANNELING_LOOP_OPTIONS,
  CHANNELING_LOOP_SOUND_ID,
  DUNGEON_LOOP_OPTIONS,
  DUNGEON_LOOP_SOUND_ID,
  SPELL_CAST_SOUND_EVENTS,
  computeZoomAudibilityGain,
  resolveAudioPlayKey,
  resolveStatusSoundId,
  shouldPlayDungeonOmen,
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
