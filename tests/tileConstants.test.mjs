import { assertEquals } from "jsr:@std/assert";
import {
  TILE_ICE, TILE_SHALLOW_WATER, TILE_LAVA,
  TILE_VOID, TILE_FLOOR, TILE_WALL, TILE_DOOR,
  TILE_STAIR_DOWN, TILE_STAIR_UP, TILE_GRASS,
  TILE_WATER, TILE_MOUNTAIN, TILE_TREE,
  TILE_GRASS_A, TILE_GRASS_C, TILE_GRASS_D,
  TILE_MOUNTAIN_B, TILE_MOUNTAIN_C, TILE_WATER_DEEP,
} from "../src/rules/environment/dungeon/constants.js";
import { isWalkable, isOpaque, loadChunk, clearAll } from "../src/rules/environment/dungeon/tileMap.js";
import { CHUNK_SIZE } from "../src/rules/environment/dungeon/constants.js";

function loadTileChunk(tileType) {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(tileType);
  loadChunk(0, 0, tiles);
}

// ── walkability ──────────────────────────────────────────────────────

Deno.test("tileConstants: TILE_ICE is walkable", () => {
  loadTileChunk(TILE_ICE);
  try {
    assertEquals(isWalkable(1, 1), true);
  } finally { clearAll(); }
});

Deno.test("tileConstants: TILE_SHALLOW_WATER is walkable", () => {
  loadTileChunk(TILE_SHALLOW_WATER);
  try {
    assertEquals(isWalkable(1, 1), true);
  } finally { clearAll(); }
});

Deno.test("tileConstants: TILE_LAVA is walkable", () => {
  loadTileChunk(TILE_LAVA);
  try {
    assertEquals(isWalkable(1, 1), true);
  } finally { clearAll(); }
});

// ── opacity ──────────────────────────────────────────────────────────

Deno.test("tileConstants: TILE_ICE is not opaque", () => {
  loadTileChunk(TILE_ICE);
  try {
    assertEquals(isOpaque(1, 1), false);
  } finally { clearAll(); }
});

Deno.test("tileConstants: TILE_SHALLOW_WATER is not opaque", () => {
  loadTileChunk(TILE_SHALLOW_WATER);
  try {
    assertEquals(isOpaque(1, 1), false);
  } finally { clearAll(); }
});

Deno.test("tileConstants: TILE_LAVA is not opaque", () => {
  loadTileChunk(TILE_LAVA);
  try {
    assertEquals(isOpaque(1, 1), false);
  } finally { clearAll(); }
});

// ── no ID collisions ────────────────────────────────────────────────

Deno.test("tileConstants: new tile IDs do not collide with existing ones", () => {
  const existing = [
    TILE_VOID, TILE_FLOOR, TILE_WALL, TILE_DOOR,
    TILE_STAIR_DOWN, TILE_STAIR_UP, TILE_GRASS,
    TILE_WATER, TILE_MOUNTAIN, TILE_TREE,
    TILE_GRASS_A, TILE_GRASS_C, TILE_GRASS_D,
    TILE_MOUNTAIN_B, TILE_MOUNTAIN_C, TILE_WATER_DEEP,
  ];
  const newTiles = [TILE_ICE, TILE_SHALLOW_WATER, TILE_LAVA];
  for (const t of newTiles) {
    assertEquals(existing.includes(t), false, `new tile ${t} collides with existing`);
  }
  // No duplicates among new tiles
  assertEquals(new Set(newTiles).size, newTiles.length, "new tile IDs must be unique");
});

Deno.test("tileConstants: new tile values are 16, 17, 18", () => {
  assertEquals(TILE_ICE, 16);
  assertEquals(TILE_SHALLOW_WATER, 17);
  assertEquals(TILE_LAVA, 18);
});
