import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { configureWorld } from "../src/main/scheduler.js";
import { AttackIntent } from "../src/rules/components/Intents/AttackIntent.js";
import { MoveIntent } from "../src/rules/components/Intents/MoveIntent.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { Faction } from "../src/rules/components/Faction.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";
import { clearAll, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";

function loadFloorChunk() {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);
}

Deno.test("bump attack resolves during the same tick (no deferred next-turn hit)", () => {
  loadFloorChunk();
  try {
    const world = new World({ seed: 0xC0FFEE });
    configureWorld(world);

    const attacker = world.create();
    world.add(attacker, Position, { x: 3, y: 3 });
    world.add(attacker, Vitality, { maxHp: 30, hp: 30 });
    world.add(attacker, Equipment, { attackDerived: 100, naturalDamageDice: "1d4" });
    world.add(attacker, Faction, { key: "player" });

    const defender = world.create();
    world.add(defender, Position, { x: 4, y: 3 });
    world.add(defender, Vitality, { maxHp: 30, hp: 30 });
    world.add(defender, Equipment, {});
    world.add(defender, Faction, { key: "enemy" });

    let resolvedEvents = 0;
    world.on("damaged", ({ target, source }) => {
      if (target === defender && source === attacker) resolvedEvents += 1;
    });
    world.on("status", ({ id, source, kind }) => {
      if (id === defender && source === attacker && (kind === "miss" || kind === "immune" || kind === "resist")) {
        resolvedEvents += 1;
      }
    });
    world.on("attack:insufficient-stamina", ({ attacker: src, defender: dst }) => {
      if (src === attacker && dst === defender) resolvedEvents += 1;
    });

    world.add(attacker, MoveIntent, { dx: 1, dy: 0 });
    world.tick(1);

    assert(resolvedEvents > 0, "bump attack should resolve in the same tick");
    assertEquals(world.has(attacker, AttackIntent), false, "bump attack should not leave a deferred AttackIntent");

    const afterFirstTick = resolvedEvents;

    world.add(attacker, MoveIntent, { dx: -1, dy: 0 });
    world.tick(1);

    assertEquals(resolvedEvents, afterFirstTick, "moving away on next turn must not trigger a delayed bump attack");
  } finally {
    clearAll();
  }
});
