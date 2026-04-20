import { assert, assertEquals } from "jsr:@std/assert";
import { isEmojiGlyph } from "../src/display/passes/glyphs/atlas.js";

Deno.test("isEmojiGlyph detects tree emoji glyphs", () => {
  assert(isEmojiGlyph("🌲"));
  assert(isEmojiGlyph("🌳"));
  assert(isEmojiGlyph("🌱"));
});

Deno.test("isEmojiGlyph does not treat ascii roguelike glyphs as emoji", () => {
  assertEquals(isEmojiGlyph("@"), false);
  assertEquals(isEmojiGlyph(","), false);
  assertEquals(isEmojiGlyph("#"), false);
});
