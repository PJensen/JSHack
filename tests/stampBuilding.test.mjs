import { assertEquals } from "jsr:@std/assert";

import { CHUNK_SIZE, TILE_GRASS } from "../src/rules/environment/dungeon/constants.js";
import { stampBuilding } from "../src/rules/environment/dungeon/stampBuilding.js";
import apothecaryDef from "../src/rules/data/buildings/apothecary.json" with { type: "json" };
import gemStoreDef from "../src/rules/data/buildings/gem_store.json" with { type: "json" };
import herbalistHutDef from "../src/rules/data/buildings/herbalist_hut.json" with { type: "json" };

function makeChunks() {
  return new Map([
    ["0,0", {
      chunkX: 0,
      chunkY: 0,
      tiles: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_GRASS),
      spawns: [],
    }],
  ]);
}

Deno.test("stampBuilding resolves shop metadata from authored building JSON", () => {
  const apoth = stampBuilding(makeChunks(), apothecaryDef, 20, 30);
  assertEquals(apoth.shop?.vendorRole, "alchemist");
  assertEquals(apoth.shop?.door, { x: 20, y: 30 });
  assertEquals(apoth.shop?.work, { x: 17, y: 27 });
  assertEquals(apoth.shop?.room, {
    name: "shop",
    roomType: "shop",
    dx: -5,
    dy: -5,
    w: 10,
    h: 6,
    x: 15,
    y: 25,
  });

  const gem = stampBuilding(makeChunks(), gemStoreDef, 40, 50);
  assertEquals(gem.shop?.vendorRole, "gem_vendor");
  assertEquals(gem.shop?.door, { x: 40, y: 50 });
  assertEquals(gem.shop?.work, { x: 39, y: 47 });
  assertEquals(gem.shop?.room, {
    name: "shop",
    roomType: "shop",
    dx: -3,
    dy: -5,
    w: 8,
    h: 6,
    x: 37,
    y: 45,
  });

  const hut = stampBuilding(makeChunks(), herbalistHutDef, 18, 28);
  assertEquals(hut.shop, null);
  assertEquals(hut.waypoints.front_door, { x: 18, y: 28 });
  assertEquals(hut.waypoints.resident_home, { x: 18, y: 26 });
  assertEquals(hut.waypoints.herb_work, { x: 19, y: 25 });
  assertEquals(hut.spawns.home_bed, { x: 16, y: 24 });
});
