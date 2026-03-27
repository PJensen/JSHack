import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { buildWorldView } from "../src/bridge/schema/worldView.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Facing } from "../src/rules/components/Facing.js";
import { BaseStats } from "../src/rules/components/BaseStats.js";
import { clearExplored } from "../src/rules/environment/dungeon/exploredMap.js";
import { clearAll, loadChunk } from "../src/rules/environment/dungeon/tileMap.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";

function loadFloorChunk() {
  clearAll();
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);
}

Deno.test("WorldView FOV hides entities behind facing direction", () => {
  loadFloorChunk();
  clearExplored();
  try {
    const world = new World({ seed: 0xC0FFEE });

    const player = world.create();
    world.add(player, Player, {});
    world.add(player, Position, { x: 10, y: 10 });
    world.add(player, NamedIdentity, { name: "Hero", identity: "player" });
    world.add(player, Facing, { dx: 1, dy: 0 }); // facing east
    world.add(player, BaseStats, { perception: 5 });

    const front = world.create();
    world.add(front, Position, { x: 12, y: 10 });
    world.add(front, NamedIdentity, { name: "Front", identity: "goblin" });

    const back = world.create();
    world.add(back, Position, { x: 8, y: 10 });
    world.add(back, NamedIdentity, { name: "Back", identity: "orc" });

    const view = buildWorldView(world);
    const ids = new Set(view.entities.map((e) => e.id));

    assert(ids.has(player), "player should always be present");
    assert(ids.has(front), "front entity should be visible");
    assertEquals(ids.has(back), false, "entity behind facing should not be visible");
  } finally {
    clearAll();
    clearExplored();
  }
});
