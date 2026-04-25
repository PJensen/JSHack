import { assert } from "jsr:@std/assert";
import { assertAlmostEquals } from "jsr:@std/assert";
import { SPELL_CAST_SOUND_EVENTS, computeZoomAudibilityGain } from "../src/display/audio/audioWiring.js";

Deno.test("audio wiring includes spider spell cast events", () => {
  assert(SPELL_CAST_SOUND_EVENTS.includes("spell:web_spit"));
  assert(SPELL_CAST_SOUND_EVENTS.includes("spell:spider_lunge"));
});

Deno.test("audio wiring zoom gain follows camera scale with clamps", () => {
  assertAlmostEquals(computeZoomAudibilityGain(64, 64), 1, 1e-10);
  assertAlmostEquals(computeZoomAudibilityGain(16, 64), 0.65, 1e-10);
  assertAlmostEquals(computeZoomAudibilityGain(256, 64), 1.35, 1e-10);
  assertAlmostEquals(computeZoomAudibilityGain(81, 64), 1.125, 1e-10);
});
