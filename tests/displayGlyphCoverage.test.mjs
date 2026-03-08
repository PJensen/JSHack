import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { buildPalette } from "../src/display/palette/index.js";
import { buildCatalogItem } from "../src/rules/data/itemCatalogLoader.js";
import { createPlayer } from "../src/rules/archetypes/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { buildWorldView } from "../src/bridge/schema/worldView.js";

Deno.test("palette includes shock trap and special weapon glyph keys", () => {
  const palette = buildPalette();
  for (const key of ["trap_shock", "dragon_whelp", "ember_knife", "flametongue", "ashen_reaver", "nightfang_dagger", "venomfang_dagger", "nightfang", "venomfang"]) {
    assert(palette[key], `missing palette key: ${key}`);
  }
});

Deno.test("flaming weapon is projected with glowing display tag", () => {
  const world = new World({ seed: 0xC0FFEE });
  createPlayer(world, { x: 10, y: 10 });
  const itemId = buildCatalogItem(world, "ember_knife");
  world.add(itemId, Position, { x: 11, y: 10 });

  const view = buildWorldView(world);
  const rec = view.entities.find((e) => e.id === itemId);

  assert(rec, "item not present in world view");
  assertEquals(rec.kind, "ember_knife");
  assert(Array.isArray(rec.tags) && rec.tags.includes("glowing"), "item should include glowing tag");
});

Deno.test("venomous weapon is projected with venom glow display tag", () => {
  const world = new World({ seed: 0xC0FFEE });
  createPlayer(world, { x: 10, y: 10 });
  const itemId = buildCatalogItem(world, "nightfang_dagger");
  world.add(itemId, Position, { x: 11, y: 10 });

  const view = buildWorldView(world);
  const rec = view.entities.find((e) => e.id === itemId);

  assert(rec, "item not present in world view");
  assertEquals(rec.kind, "nightfang_dagger");
  assert(Array.isArray(rec.tags) && rec.tags.includes("venom_glowing"), "item should include venom_glowing tag");
});

Deno.test("venomfang dagger is projected with venom glow display tag", () => {
  const world = new World({ seed: 0xC0FFEE });
  createPlayer(world, { x: 10, y: 10 });
  const itemId = buildCatalogItem(world, "venomfang_dagger");
  world.add(itemId, Position, { x: 11, y: 10 });

  const view = buildWorldView(world);
  const rec = view.entities.find((e) => e.id === itemId);

  assert(rec, "item not present in world view");
  assertEquals(rec.kind, "venomfang_dagger");
  assert(Array.isArray(rec.tags) && rec.tags.includes("venom_glowing"), "item should include venom_glowing tag");
});
