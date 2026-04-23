import { assert } from "jsr:@std/assert";
import { SPELL_CAST_SOUND_EVENTS } from "../src/display/audio/audioWiring.js";

Deno.test("audio wiring includes spider spell cast events", () => {
  assert(SPELL_CAST_SOUND_EVENTS.includes("spell:web_spit"));
  assert(SPELL_CAST_SOUND_EVENTS.includes("spell:spider_lunge"));
});
