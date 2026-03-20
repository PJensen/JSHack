import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { installDeathShareWiring } from "../src/main/wiring/deathShareWiring.js";
import { Player } from "../src/rules/components/Player.js";
import { Score } from "../src/rules/components/Score.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";

Deno.test("death share wiring dispatches ui:playerDied with share URL", () => {
  const world = new World({ seed: 42 });
  const prevVersion = globalThis.VERSION;
  globalThis.VERSION = "1.9.3";
  installDeathShareWiring({ world });

  const playerId = world.create();
  world.add(playerId, Player, {});
  world.add(playerId, Score, { current: 123 });

  const killerId = world.create();
  world.add(killerId, NamedIdentity, { name: "Goblin Archer", identity: "goblin_archer" });

  const dungeonId = world.create();
  world.add(dungeonId, DungeonState, {
    seed: 42,
    worldSeed: 0xC0FFEE,
    currentDepth: 3,
    currentChunkX: 0,
    currentChunkY: 0,
    floorEntityIds: [],
    spawnChunkX: 0,
    spawnChunkY: 0,
  });

  /** @type {any} */
  let detail = null;
  const onDied = (ev) => { detail = ev.detail; };
  globalThis.addEventListener("ui:playerDied", onDied);
  try {
    world.emit("died", { id: playerId, killer: killerId, cause: "melee" });
    world.emit("postMortemComplete");
  } finally {
    globalThis.removeEventListener("ui:playerDied", onDied);
    globalThis.VERSION = prevVersion;
  }

  assert(detail, "expected ui:playerDied detail");
  assertEquals(detail.depth, 3);
  assertEquals(detail.score, 123);
  assertEquals(detail.seed, 0xC0FFEE);
  assertEquals(detail.killerName, "Goblin Archer");
  assertEquals(detail.killedBy, "Goblin Archer");
  assertEquals(detail.cause, "melee");
  assertEquals(detail.versionText, "1.9.3");
  assertEquals(detail.versionNumber, 193);
  assertEquals(detail.version, 193);
  assert(String(detail.shareUrl || "").startsWith("https://x.com/intent/tweet?"), "share URL should be X intent");
});

Deno.test("death share wiring installs once per world", () => {
  const world = new World({ seed: 7 });
  installDeathShareWiring({ world });
  installDeathShareWiring({ world });

  const playerId = world.create();
  world.add(playerId, Player, {});
  world.add(playerId, Score, { current: 10 });
  const dungeonId = world.create();
  world.add(dungeonId, DungeonState, {
    seed: 7,
    worldSeed: 7,
    currentDepth: 1,
    currentChunkX: 0,
    currentChunkY: 0,
    floorEntityIds: [],
    spawnChunkX: 0,
    spawnChunkY: 0,
  });

  let fired = 0;
  const onDied = () => { fired += 1; };
  globalThis.addEventListener("ui:playerDied", onDied);
  try {
    world.emit("died", { id: playerId, cause: "trap" });
    world.emit("postMortemComplete");
  } finally {
    globalThis.removeEventListener("ui:playerDied", onDied);
  }

  assertEquals(fired, 1);
});
