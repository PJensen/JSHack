import { assert, assertEquals } from "jsr:@std/assert";
import { basePalette } from "../src/display/palette/base.js";
import { buildPalette } from "../src/display/palette/index.js";

Deno.test("buildPalette preserves layers array on composite entries", () => {
  const palette = buildPalette();
  const bed = palette["bed_home"];
  assert(bed, "bed_home missing from palette");
  assert(Array.isArray(bed.layers), "bed_home should have layers array");
  assert(bed.layers.length >= 2, "bed_home should have at least 2 layers");
  assertEquals(typeof bed.layers[0].glyph, "string");
  assertEquals(typeof bed.layers[0].fg, "string");
});

Deno.test("composite entries do not generate broken corpse entries", () => {
  const palette = buildPalette();
  // bed_home is a composite — should not produce corpse_bed_home
  assert(!palette["corpse_bed_home"], "corpse_bed_home should not exist");
});

Deno.test("existing single-glyph entries are unaffected", () => {
  const palette = buildPalette();
  const rat = palette["rat"];
  assert(rat, "rat missing from palette");
  assertEquals(rat.glyph, "r");
  assertEquals(typeof rat.fg, "string");
  // rat should still get a corpse entry
  const corpse = palette["corpse_rat"];
  assert(corpse, "corpse_rat missing");
  assertEquals(corpse.glyph, "%");
});
