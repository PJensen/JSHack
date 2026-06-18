import "./helpers/installContentCatalog.mjs";
import "./helpers/installContentMonsters.mjs";
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Position } from "../src/rules/components/Position.js";
import { Player } from "../src/rules/components/Player.js";
import { DungeonEntrance } from "../src/rules/components/DungeonEntrance.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { buildWorldView } from "../src/bridge/schema/worldView.js";
import { initDungeon } from "../src/rules/environment/dungeon/index.js";
import { generateFloorPlan } from "../src/rules/environment/dungeon/floorPlan.js";
import { transitionToDepth, clearFloorCache } from "../src/rules/environment/dungeon/transition.js";
import { clearAll, setTile, getTile, loadedChunkCount } from "../src/rules/environment/dungeon/tileMap.js";
import { TILE_FLOOR, TILE_VOID, TILE_WALL } from "../src/rules/environment/dungeon/constants.js";
import { getUnderworldRegionTemplate } from "../src/rules/environment/dungeon/underworldRegions.js";
import { markDestroyedTile } from "../src/rules/utils/destroyedTiles.js";
import { markWet, isWetAt } from "../src/rules/utils/wetTileMap.js";

function addPlayer(world, x, y) {
  const id = world.create();
  world.add(id, Player, {});
  world.add(id, Position, { x, y });
  return id;
}

function dungeonState(world) {
  for (const [, ds] of world.query(DungeonState)) return ds;
  throw new Error("missing DungeonState");
}

function entranceByTemplate(world, templateId) {
  for (const [id, entrance, pos] of world.query(DungeonEntrance, Position)) {
    if (String(entrance.templateId || "") === templateId) {
      return { id, entrance, pos: { x: pos.x | 0, y: pos.y | 0 } };
    }
  }
  throw new Error(`missing entrance ${templateId}`);
}

function countIdentity(world, identity) {
  let count = 0;
  for (const [, ni] of world.query(NamedIdentity, Position)) {
    if (String(ni?.identity || "") === identity) count++;
  }
  return count;
}

Deno.test("overworld stairs carry authored underworld entrance metadata", async () => {
  clearFloorCache();
  clearAll();
  const world = new World({ seed: 0x5151 });
  const spawn = await initDungeon(world, { startDepth: 0 });
  addPlayer(world, spawn.x, spawn.y);

  const tavern = entranceByTemplate(world, "tavern_basement");
  const crypt = entranceByTemplate(world, "graveyard_crypt");
  const templates = new Set();
  for (const [, entrance] of world.query(DungeonEntrance, Position)) {
    templates.add(String(entrance.templateId || ""));
  }

  assertEquals(tavern.entrance.targetDepth, 1);
  assertEquals(tavern.entrance.floors, 3);
  assertEquals(crypt.entrance.targetDepth, 1);
  assert(tavern.pos.x !== crypt.pos.x || tavern.pos.y !== crypt.pos.y, "starter entrances should be distinct overworld anchors");
  for (const templateId of [
    "bear_cave",
    "bat_cave",
    "human_mine",
    "bandit_hideout",
    "old_well",
    "collapsed_cellar",
    "wolf_den",
    "forgotten_shrine",
  ]) {
    assert(templates.has(templateId), `overworld should place ${templateId} entrance metadata`);
  }
});

Deno.test("underworld templates author floor count, population count, and trap presence", () => {
  const tavern = getUnderworldRegionTemplate("tavern_basement");
  const bandits = getUnderworldRegionTemplate("bandit_hideout");

  assertEquals(tavern.floors, 3);
  assertEquals(tavern.content.monsters[0], { id: "rat", count: 12 });
  assertEquals(tavern.content.trapsPresent, false);
  assertEquals(tavern.content.traps.length, 0);
  assertEquals(bandits.content.trapsPresent, true);
  assert(bandits.content.traps.length > 0, "trap-present authored dungeon should list concrete traps");
});

Deno.test("authored underworld floor count controls generated down-stairs", () => {
  const seed = 0x7272;
  const opts = { templateId: "tavern_basement", anchorX: 64, anchorY: 64 };
  const first = generateFloorPlan(seed, 1, [{ x: 64, y: 64 }], opts);
  const second = generateFloorPlan(seed, 2, [{ x: 64, y: 64 }], opts);
  const third = generateFloorPlan(seed, 3, [{ x: 64, y: 64 }], opts);

  assertEquals(first.floors, 3);
  assertEquals(first.downStairs.length, 1);
  assertEquals(second.downStairs.length, 1);
  assertEquals(third.downStairs.length, 0);
});

Deno.test("world view projects entrance floor badge metadata", async () => {
  clearFloorCache();
  clearAll();
  const world = new World({ seed: 0x5353 });
  const spawn = await initDungeon(world, { startDepth: 0 });
  const player = addPlayer(world, spawn.x, spawn.y);

  const tavern = entranceByTemplate(world, "tavern_basement");
  world.set(player, Position, tavern.pos);
  const view = buildWorldView(world);
  const rec = view.entities.find((entity) => entity.id === tavern.id);

  assert(rec, "tavern entrance should be projected");
  assertEquals(rec.entranceBadge.level, 1);
  assertEquals(rec.entranceBadge.floors, 3);
  assert(rec.tags.includes("dungeon_entrance"), "entrance should carry display tag");
});

Deno.test("depth one sparse regions are distinct by entrance anchor and template", async () => {
  clearFloorCache();
  clearAll();
  const world = new World({ seed: 0x6161 });
  const spawn = await initDungeon(world, { startDepth: 0 });
  addPlayer(world, spawn.x, spawn.y);

  const tavern = entranceByTemplate(world, "tavern_basement");
  await transitionToDepth(world, 1, tavern.pos, {
    direction: "down",
    stairPos: tavern.pos,
    templateId: tavern.entrance.templateId,
    anchorX: tavern.entrance.anchorX,
    anchorY: tavern.entrance.anchorY,
  });
  const tavernState = { ...dungeonState(world) };

  await transitionToDepth(world, 0, tavern.pos, { direction: "up", stairPos: tavern.pos });
  const crypt = entranceByTemplate(world, "graveyard_crypt");
  await transitionToDepth(world, 1, crypt.pos, {
    direction: "down",
    stairPos: crypt.pos,
    templateId: crypt.entrance.templateId,
    anchorX: crypt.entrance.anchorX,
    anchorY: crypt.entrance.anchorY,
  });
  const cryptState = dungeonState(world);

  assertEquals(tavernState.currentDepth, 1);
  assertEquals(cryptState.currentDepth, 1);
  assertEquals(tavernState.activeTemplateId, "tavern_basement");
  assertEquals(cryptState.activeTemplateId, "graveyard_crypt");
  assert(tavernState.activeRegionKey !== cryptState.activeRegionKey, "same-depth authored regions need distinct sparse keys");
});

Deno.test("authored starter regions produce targeted content", async () => {
  clearFloorCache();
  clearAll();
  const world = new World({ seed: 0x7171 });
  const spawn = await initDungeon(world, { startDepth: 0 });
  addPlayer(world, spawn.x, spawn.y);

  const tavern = entranceByTemplate(world, "tavern_basement");
  await transitionToDepth(world, 1, tavern.pos, {
    direction: "down",
    stairPos: tavern.pos,
    templateId: tavern.entrance.templateId,
    anchorX: tavern.entrance.anchorX,
    anchorY: tavern.entrance.anchorY,
  });
  assert(countIdentity(world, "rat") >= 10, "tavern basement should be rat-heavy");
  assert(countIdentity(world, "skeleton") >= 3, "graveyard crypt should be resident on the same depth-one plane");
  assert(countIdentity(world, "book_dead") >= 1, "graveyard crypt objective should be resident with the depth-one plane");

  await transitionToDepth(world, 0, tavern.pos, { direction: "up", stairPos: tavern.pos });
  const crypt = entranceByTemplate(world, "graveyard_crypt");
  await transitionToDepth(world, 1, crypt.pos, {
    direction: "down",
    stairPos: crypt.pos,
    templateId: crypt.entrance.templateId,
    anchorX: crypt.entrance.anchorX,
    anchorY: crypt.entrance.anchorY,
  });
  assert(countIdentity(world, "skeleton") >= 3, "graveyard crypt should be skeleton-heavy");
  assert(countIdentity(world, "book_dead") >= 1, "graveyard crypt should place the Book of the Dead objective");
});

Deno.test("depth one authored regions are resident on the same plane", async () => {
  clearFloorCache();
  clearAll();
  const world = new World({ seed: 0x9191 });
  const spawn = await initDungeon(world, { startDepth: 0 });
  addPlayer(world, spawn.x, spawn.y);

  const tavern = entranceByTemplate(world, "tavern_basement");
  const crypt = entranceByTemplate(world, "graveyard_crypt");
  await transitionToDepth(world, 1, tavern.pos, {
    direction: "down",
    stairPos: tavern.pos,
    templateId: tavern.entrance.templateId,
    anchorX: tavern.entrance.anchorX,
    anchorY: tavern.entrance.anchorY,
  });

  assertEquals(dungeonState(world).currentDepth, 1);
  assert(loadedChunkCount() >= 2, "depth-one plane should include more than the active entrance chunk");
  assert(getTile(tavern.pos.x, tavern.pos.y) !== TILE_VOID, "tavern basement anchor should be loaded");
  assert(getTile(crypt.pos.x, crypt.pos.y) !== TILE_VOID, "graveyard crypt anchor should be loaded from tavern basement");
});

Deno.test("expanded authored entrances contribute themed resident content", async () => {
  clearFloorCache();
  clearAll();
  const world = new World({ seed: 0x5151 });
  const spawn = await initDungeon(world, { startDepth: 0 });
  addPlayer(world, spawn.x, spawn.y);

  const tavern = entranceByTemplate(world, "tavern_basement");
  const bear = entranceByTemplate(world, "bear_cave");
  const bandits = entranceByTemplate(world, "bandit_hideout");
  const mine = entranceByTemplate(world, "human_mine");
  await transitionToDepth(world, 1, tavern.pos, {
    direction: "down",
    stairPos: tavern.pos,
    templateId: tavern.entrance.templateId,
    anchorX: tavern.entrance.anchorX,
    anchorY: tavern.entrance.anchorY,
  });

  assert(getTile(bear.pos.x, bear.pos.y) !== TILE_VOID, "bear cave should be resident from tavern basement");
  assert(getTile(bandits.pos.x, bandits.pos.y) !== TILE_VOID, "bandit hideout should be resident from tavern basement");
  assert(getTile(mine.pos.x, mine.pos.y) !== TILE_VOID, "human mine should be resident from tavern basement");
  assert(countIdentity(world, "cave_bear") >= 1, "bear cave should contain its dangerous bear");
  assert(countIdentity(world, "bat") >= 6, "bat cave should be bat-heavy");
  assert(countIdentity(world, "bandit_archer") >= 2, "bandit hideout should include archers");
  assert(countIdentity(world, "townfolk_miner") >= 2, "human mine should include working miners");
});

Deno.test("mutable tile state is scoped by sparse underworld region", async () => {
  clearFloorCache();
  clearAll();
  const world = new World({ seed: 0x8181 });
  const spawn = await initDungeon(world, { startDepth: 0 });
  addPlayer(world, spawn.x, spawn.y);

  const tavern = entranceByTemplate(world, "tavern_basement");
  await transitionToDepth(world, 1, tavern.pos, {
    direction: "down",
    stairPos: tavern.pos,
    templateId: tavern.entrance.templateId,
    anchorX: tavern.entrance.anchorX,
    anchorY: tavern.entrance.anchorY,
  });
  setTile(tavern.pos.x, tavern.pos.y, TILE_WALL);
  markDestroyedTile(world, {
    x: tavern.pos.x,
    y: tavern.pos.y,
    originalTile: TILE_FLOOR,
    currentTile: TILE_WALL,
  });
  markWet(world, tavern.pos.x + 1, tavern.pos.y, 10);
  assert(isWetAt(world, tavern.pos.x + 1, tavern.pos.y), "tavern wet tile should be live before transition");

  await transitionToDepth(world, 0, tavern.pos, { direction: "up", stairPos: tavern.pos });
  const crypt = entranceByTemplate(world, "graveyard_crypt");
  await transitionToDepth(world, 1, crypt.pos, {
    direction: "down",
    stairPos: crypt.pos,
    templateId: crypt.entrance.templateId,
    anchorX: crypt.entrance.anchorX,
    anchorY: crypt.entrance.anchorY,
  });
  assert(isWetAt(world, tavern.pos.x + 1, tavern.pos.y), "crypt should share the resident depth-one plane with tavern wet tiles");

  await transitionToDepth(world, 0, crypt.pos, { direction: "up", stairPos: crypt.pos });
  await transitionToDepth(world, 1, tavern.pos, {
    direction: "down",
    stairPos: tavern.pos,
    templateId: tavern.entrance.templateId,
    anchorX: tavern.entrance.anchorX,
    anchorY: tavern.entrance.anchorY,
  });
  assertEquals(getTile(tavern.pos.x, tavern.pos.y), TILE_WALL);
  assert(isWetAt(world, tavern.pos.x + 1, tavern.pos.y), "tavern wet tile should restore with tavern region");
});
