import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Player } from "../src/rules/components/Player.js";
import { installSavegameWiring } from "../src/main/wiring/savegameWiring.js";
import { SAVEGAME_KEY } from "../src/main/wiring/savegameLoad.js";

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

function withMockLocalStorage(store, fn) {
  const hasOriginal = Object.prototype.hasOwnProperty.call(globalThis, "localStorage");
  const original = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", {
    value: store,
    configurable: true,
    writable: true,
  });
  try {
    fn();
  } finally {
    if (hasOriginal) {
      Object.defineProperty(globalThis, "localStorage", {
        value: original,
        configurable: true,
        writable: true,
      });
    } else {
      delete globalThis.localStorage;
    }
  }
}

Deno.test("savegameWiring clears save when player dies", () => {
  const world = new World({ seed: 42 });
  const playerId = world.create();
  world.add(playerId, Player);
  const store = memoryStorage();
  store.setItem(SAVEGAME_KEY, JSON.stringify({ v: 1, world: { v: 1, comps: {} } }));

  withMockLocalStorage(store, () => {
    installSavegameWiring({
      world,
      playerEntity: () => ({ id: playerId, pos: { x: 0, y: 0 } }),
    });
    world.emit("died", { id: playerId });
  });

  assertEquals(store.getItem(SAVEGAME_KEY), null);
});

Deno.test("savegameWiring ignores non-player deaths", () => {
  const world = new World({ seed: 42 });
  const playerId = world.create();
  world.add(playerId, Player);
  const monsterId = world.create();
  const store = memoryStorage();
  const payload = JSON.stringify({ v: 1, world: { v: 1, comps: {} } });
  store.setItem(SAVEGAME_KEY, payload);

  withMockLocalStorage(store, () => {
    installSavegameWiring({
      world,
      playerEntity: () => ({ id: playerId, pos: { x: 0, y: 0 } }),
    });
    world.emit("died", { id: monsterId });
  });

  assert(store.getItem(SAVEGAME_KEY));
  assertEquals(store.getItem(SAVEGAME_KEY), payload);
});

Deno.test("savegameWiring saves when player finishes bed rest", () => {
  const world = new World({ seed: 42 });
  const playerId = world.create();
  world.add(playerId, Player);
  const store = memoryStorage();

  withMockLocalStorage(store, () => {
    installSavegameWiring({
      world,
      playerEntity: () => ({ id: playerId, pos: { x: 0, y: 0 } }),
      getActiveSpellId: () => "spark",
      getActionBarSlots: () => ["spark", null],
      getPinnedSpellSlots: () => [null, "spark"],
    });
    world.emit("bed:rested", { actor: playerId, targetId: 99, turns: 720 });
  });

  const raw = store.getItem(SAVEGAME_KEY);
  assert(raw, "save payload should be written");
  const payload = JSON.parse(raw);
  assertEquals(payload.reason, "bed:rested");
  assertEquals(payload.app.activeSpellId, "spark");
  assertEquals(payload.app.actionBarSlots, ["spark", null]);
  assertEquals(payload.app.pinnedSpellSlots, [null, "spark"]);
});
