import "./helpers/installContentCatalog.mjs";
import "./helpers/installContentMonsters.mjs";
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Position } from "../src/rules/components/Position.js";
import { Player } from "../src/rules/components/Player.js";
import { DungeonEntrance } from "../src/rules/components/DungeonEntrance.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { initDungeon } from "../src/rules/environment/dungeon/index.js";
import { transitionToDepth, clearFloorCache } from "../src/rules/environment/dungeon/transition.js";
import { clearAll, setTile, getTile } from "../src/rules/environment/dungeon/tileMap.js";
import { TILE_FLOOR, TILE_WALL } from "../src/rules/environment/dungeon/constants.js";
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

  assertEquals(tavern.entrance.targetDepth, 1);
  assertEquals(crypt.entrance.targetDepth, 1);
  assert(tavern.pos.x !== crypt.pos.x || tavern.pos.y !== crypt.pos.y, "starter entrances should be distinct overworld anchors");
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
  assert(countIdentity(world, "rat") >= 5, "tavern basement should be rat-heavy");

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
  assert(!isWetAt(world, tavern.pos.x + 1, tavern.pos.y), "crypt should not inherit tavern wet tiles");

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
