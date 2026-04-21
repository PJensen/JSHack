import { assert, assertEquals } from "jsr:@std/assert";
import { getProcStateVisual } from "../src/display/fx/procStateGlyphs.js";

Deno.test("serpent proc states have explicit proc badge visuals", () => {
  const hide = getProcStateVisual("serpent_hide");
  const riposte = getProcStateVisual("serpent_riposte");
  const specters = getProcStateVisual("serpent_specters");

  assertEquals(hide.glyph, "🐍");
  assertEquals(riposte.glyph, "⚔");
  assertEquals(specters.glyph, "👻");

  assert(hide.r !== riposte.r || hide.g !== riposte.g || hide.b !== riposte.b, "hide and riposte should be visually distinct");
});
