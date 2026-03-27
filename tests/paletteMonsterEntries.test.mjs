import { assert, assertEquals } from "jsr:@std/assert";
import { buildPalette } from "../src/display/palette/index.js";

Deno.test("palette includes boar and flaming_bat entries", () => {
  const palette = buildPalette();
  assert(palette.boar, "boar palette entry missing");
  assert(palette.flaming_bat, "flaming_bat palette entry missing");
  assert(palette.death_archer, "death_archer palette entry missing");
  assert(palette.bandit, "bandit palette entry missing");
  assert(palette.bandit_archer, "bandit_archer palette entry missing");
  assert(palette.bandit_captain, "bandit_captain palette entry missing");
  assert(palette.dire_wolf, "dire_wolf palette entry missing");
  assert(palette.acid_spitter, "acid_spitter palette entry missing");
});

Deno.test("duplicate 'b' monster glyphs are discriminated by color", () => {
  const palette = buildPalette();
  assertEquals(palette.bat?.glyph, "b");
  assertEquals(palette.boar?.glyph, "b");
  assertEquals(palette.flaming_bat?.glyph, "b");
  assertEquals(palette.bandit?.glyph, "b");
  assertEquals(palette.bandit_archer?.glyph, "b");
  assertEquals(palette.bandit_captain?.glyph, "b");
  const colors = new Set([
    palette.bat?.fg,
    palette.boar?.fg,
    palette.flaming_bat?.fg,
    palette.bandit?.fg,
    palette.bandit_archer?.fg,
    palette.bandit_captain?.fg,
  ]);
  assert(
    colors.size === 6,
    "all 'b' monsters must use distinct colors",
  );
});
