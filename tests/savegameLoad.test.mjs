import { assert, assertEquals, assertThrows } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import {
  SAVEGAME_KEY,
  hasSavegame,
  readSavegamePayload,
  clearSavegamePayload,
  readSavedDepth,
  readSavedSeed,
  restoreSnapshotFromSavegame,
} from "../src/main/wiring/savegameLoad.js";

function memoryStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
  };
}

function makeSave() {
  return {
    v: 1,
    world: {
      v: 1,
      meta: { seed: 0x1234abcd, frame: 0, time: 0, store: "map" },
      alive: [7, 11],
      comps: {
        Player: [[7, {}]],
        Position: [[7, { x: 3, y: 4 }]],
        DungeonState: [[11, { worldSeed: 0x1234abcd, currentDepth: 5, floorEntityIds: [] }]],
      },
    },
    app: { activeSpellId: "spell:fireball" },
  };
}

Deno.test("savegame storage helpers round-trip payload", () => {
  const store = memoryStorage();
  assert(!hasSavegame(store), "storage should start empty");

  const payload = makeSave();
  store.setItem(SAVEGAME_KEY, JSON.stringify(payload));
  assert(hasSavegame(store), "save marker should be visible");

  const read = readSavegamePayload(store);
  assert(read && read.v === 1, "parsed save payload should be returned");
  assertEquals(read?.world?.meta?.seed, payload.world.meta.seed);

  clearSavegamePayload(store);
  assert(!hasSavegame(store), "save should be removed");
  assertEquals(readSavegamePayload(store), null);
});

Deno.test("savegame seed/depth readers handle valid payload", () => {
  const payload = makeSave();
  assertEquals(readSavedSeed(payload), payload.world.meta.seed >>> 0);
  assertEquals(readSavedDepth(payload), 5);
});

Deno.test("restoreSnapshotFromSavegame replaces world state from snapshot", () => {
  const world = new World({ seed: 1 });
  const old = world.create();
  world.add(old, Position, { x: 99, y: 99 });

  const payload = makeSave();
  restoreSnapshotFromSavegame(world, payload);

  assert(!world.isAlive(old), "existing world state should be replaced");
  assert(world.isAlive(7), "saved player id should exist after restore");
  assert(world.get(7, Player), "player component should be restored");

  const pos = world.get(7, Position);
  assert(pos, "player position should exist");
  assertEquals(pos?.x, 3);
  assertEquals(pos?.y, 4);

  const ds = world.get(11, DungeonState);
  assert(ds, "dungeon state should be restored");
  assertEquals(ds?.currentDepth, 5);
});

Deno.test("restoreSnapshotFromSavegame rejects invalid player snapshot", () => {
  const world = new World({ seed: 1 });
  const bad = makeSave();
  bad.world.comps.Player = [];
  assertThrows(() => restoreSnapshotFromSavegame(world, bad), Error, "invalid save");
});
