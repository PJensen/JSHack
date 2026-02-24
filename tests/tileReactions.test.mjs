import { assertEquals, assertNotEquals } from "jsr:@std/assert";
import { findTileReaction, getReactionsForTile, TILE_REACTIONS } from "../src/rules/data/tileReactions.js";
import {
  TILE_WALL, TILE_TREE, TILE_FLOOR, TILE_GRASS, TILE_VOID,
} from "../src/rules/environment/dungeon/constants.js";

// ── findTileReaction ────────────────────────────────────────────────

Deno.test("tileReactions: wall + dig bonus returns dig reaction", () => {
  const r = findTileReaction(TILE_WALL, { dig: true });
  assertNotEquals(r, null, "should find a reaction for wall + dig");
  assertEquals(r.result, TILE_FLOOR, "digging a wall should yield floor");
  assertEquals(r.event, "tile:dug");
});

Deno.test("tileReactions: wall without dig bonus returns null", () => {
  const r = findTileReaction(TILE_WALL, { chop: true });
  assertEquals(r, null, "no dig bonus means no wall reaction");
});

Deno.test("tileReactions: tree + chop bonus returns chop reaction", () => {
  const r = findTileReaction(TILE_TREE, { chop: true });
  assertNotEquals(r, null, "should find a reaction for tree + chop");
  assertEquals(r.result, TILE_GRASS, "chopping a tree should yield grass");
  assertEquals(r.event, "tile:chopped");
});

Deno.test("tileReactions: tree without chop bonus returns null", () => {
  const r = findTileReaction(TILE_TREE, { dig: true });
  assertEquals(r, null, "no chop bonus means no tree reaction");
});

Deno.test("tileReactions: floor tile has no reactions", () => {
  const r = findTileReaction(TILE_FLOOR, { dig: true, chop: true });
  assertEquals(r, null, "floor should have no reactions");
});

Deno.test("tileReactions: null/empty bonuses returns null", () => {
  assertEquals(findTileReaction(TILE_WALL, null), null);
  assertEquals(findTileReaction(TILE_WALL, {}), null);
});

// ── getReactionsForTile ─────────────────────────────────────────────

Deno.test("tileReactions: getReactionsForTile returns correct counts", () => {
  assertEquals(getReactionsForTile(TILE_WALL).length, 1);
  assertEquals(getReactionsForTile(TILE_TREE).length, 1);
  assertEquals(getReactionsForTile(TILE_FLOOR).length, 0);
  assertEquals(getReactionsForTile(TILE_VOID).length, 0);
});

// ── data integrity ──────────────────────────────────────────────────

Deno.test("tileReactions: all entries have required fields", () => {
  for (const r of TILE_REACTIONS) {
    assertEquals(typeof r.tile, "number", `${r.event}: tile must be a number`);
    assertEquals(typeof r.requires.bonus, "string", `${r.event}: requires.bonus must be a string`);
    assertEquals(typeof r.costField, "string", `${r.event}: costField must be a string`);
    assertEquals(typeof r.costDefault, "number", `${r.event}: costDefault must be a number`);
    assertEquals(typeof r.result, "number", `${r.event}: result must be a number`);
    assertEquals(typeof r.event, "string", `${r.event}: event must be a string`);
  }
});

Deno.test("tileReactions: wall reaction has backfill, tree does not", () => {
  const wall = findTileReaction(TILE_WALL, { dig: true });
  assertEquals(wall.backfill, TILE_WALL, "wall dig should backfill void neighbors with wall");
  const tree = findTileReaction(TILE_TREE, { chop: true });
  assertEquals(tree.backfill, undefined, "tree chop should not have backfill");
});
