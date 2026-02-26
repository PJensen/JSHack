import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { buildPalette } from "../src/display/palette/index.js";
import { buildCatalogItem } from "../src/rules/data/itemCatalogLoader.js";
import { createPlayer } from "../src/rules/archetypes/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { buildWorldView } from "../src/bridge/schema/worldView.js";

Deno.test("palette includes shock trap and flaming weapon glyph keys", () => {
  const palette = buildPalette();
  for (const key of ["trap_shock", "ember_knife", "flametongue", "ashen_reaver"]) {
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
