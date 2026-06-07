import "./helpers/installContentMonsters.mjs";
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { DeityChallengeCompleted } from "../src/events/DeityChallengeCompleted.js";
import { DeityChallengeStarted } from "../src/events/DeityChallengeStarted.js";
import { CHUNK_SIZE, TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";
import {
  clearAll as clearTileMap,
  loadChunk,
} from "../src/rules/environment/dungeon/tileMap.js";
import {
  clearExplored,
  markExplored,
  updateFOV,
} from "../src/rules/environment/dungeon/exploredMap.js";
import { DeityAuthorshipState } from "../src/rules/components/DeityAuthorshipState.js";
import { DeityChallengeMember } from "../src/rules/components/DeityChallengeMember.js";
import { Devotion } from "../src/rules/components/Devotion.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { RoomMetadata } from "../src/rules/components/RoomMetadata.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { deityChallengeSystem } from "../src/rules/systems/deityChallengeSystem.js";
import { recordDeathApplied } from "../src/rules/utils/deathApplied.js";

function resetMaps() {
  clearTileMap();
  clearExplored();
}

function loadFloorChunk() {
  const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE);
  tiles.fill(TILE_FLOOR);
  loadChunk(0, 0, tiles);
}

function exploreRoom(room) {
  for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
    for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
      markExplored(x, y);
    }
  }
}

function setupWorld({ visibleRoom = false } = {}) {
  resetMaps();
  loadFloorChunk();

  const world = new World({ seed: 0xD317 });
  world.step = 100;

  const dungeon = world.create();
  world.add(dungeon, DungeonState, {
    worldSeed: 0xD317,
    currentDepth: 2,
    floorEntityIds: [],
  });

  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 20, y: 20 });
  world.add(player, Devotion, { deityId: "aurelia" });
  world.add(player, Vitality, { hp: 20, maxHp: 20 });

  const room = { roomType: "generic", x: 2, y: 2, w: 7, h: 7 };
  const roomEntity = world.create();
  world.add(roomEntity, RoomMetadata, room);
  exploreRoom(room);

  if (visibleRoom) {
    updateFOV(world.step, 5, 5, 12, () => false);
  }

  return { world, dungeon, player, room };
}

function runQuietTurns(world, turns = 12) {
  for (let i = 0; i < turns; i++) {
    world.step = 100 + i;
    deityChallengeSystem(world);
  }
}

Deno.test("deityChallengeSystem spawns a monster challenge in an explored cleared room", () => {
  const { world, dungeon, player, room } = setupWorld();
  const events = [];
  world.on(DeityChallengeStarted, (ev) => events.push(ev));

  runQuietTurns(world);

  const challenges = [...world.query(DeityAuthorshipState)];
  assertEquals(challenges.length, 1);
  const [challengeId, challenge] = challenges[0];
  assertEquals(challenge.playerId, player);
  assertEquals(challenge.state, "active");
  assert(challenge.remaining > 0);

  const members = [...world.query(DeityChallengeMember)];
  assertEquals(members.length, challenge.remaining);
  for (const [monsterId, member] of members) {
    assertEquals(member.challengeId, challengeId);
    const pos = world.get(monsterId, Position);
    assert(pos, "challenge member should have a position");
    assert(pos.x > room.x && pos.x < room.x + room.w - 1);
    assert(pos.y > room.y && pos.y < room.y + room.h - 1);
  }

  const ds = world.get(dungeon, DungeonState);
  assert(ds.floorEntityIds.includes(challengeId), "challenge root should be floor-tracked");
  assert(events.length === 1, "challenge event should be emitted");
});

Deno.test("deityChallengeSystem does not spawn ordinary challenges in visible rooms", () => {
  const { world } = setupWorld({ visibleRoom: true });

  runQuietTurns(world);

  assertEquals([...world.query(DeityAuthorshipState)].length, 0);
  assertEquals([...world.query(DeityChallengeMember)].length, 0);
});

Deno.test("deityChallengeSystem rewards the player when all challenge monsters die", () => {
  const { world, dungeon, player } = setupWorld();
  const completed = [];
  world.on(DeityChallengeCompleted, (ev) => completed.push(ev));

  runQuietTurns(world);
  const [[challengeId]] = [...world.query(DeityAuthorshipState)];
  const members = [...world.query(DeityChallengeMember)];
  assert(members.length > 0, "expected at least one challenge monster");

  for (const [monsterId] of members) {
    const pos = world.get(monsterId, Position);
    const vit = world.get(monsterId, Vitality);
    if (vit) vit.hp = 0;
    recordDeathApplied(world, {
      target: monsterId,
      killer: player,
      at: pos ? { x: pos.x | 0, y: pos.y | 0 } : null,
    });
  }

  world.step = 200;
  deityChallengeSystem(world);

  const challenge = world.get(challengeId, DeityAuthorshipState);
  assertEquals(challenge.state, "completed");
  assertEquals(challenge.remaining, 0);
  assertEquals(challenge.rewardSpawned, true);
  assertEquals(completed.length, 1);
  assert(completed[0].rewardId > 0, "completion should materialize a reward");

  const rewardInfo = world.get(completed[0].rewardId, ItemInfo);
  assertEquals(rewardInfo?.type, "currency");
  const ds = world.get(dungeon, DungeonState);
  assert(ds.floorEntityIds.includes(completed[0].rewardId), "reward should be floor-tracked");
});
