// @ts-nocheck
import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { initDungeon } from "../src/rules/environment/dungeon/index.js";
import { transitionToDepth } from "../src/rules/environment/dungeon/transition.js";
import { createPlayer } from "../src/rules/archetypes/Player.js";
import { createItemById } from "../src/rules/utils/itemFactory.js";
import { useItemSystem } from "../src/rules/systems/useItemSystem.js";
import { interactionSystem } from "../src/rules/systems/interactionSystem.js";
import { resolveHomecomingRequest } from "../src/rules/systems/homecomingSystem.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { Position } from "../src/rules/components/Position.js";
import { Collider } from "../src/rules/components/Collider.js";
import { InteractIntent } from "../src/rules/components/Intents/InteractIntent.js";
import { UseIntent } from "../src/rules/components/Intents/UseIntent.js";
import { Inventory } from "../src/rules/components/Inventory.js";

function cheb(a, b) {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

function flushHomecoming(world, requests) {
  const req = requests.shift();
  if (req) resolveHomecomingRequest(world, req);
}

Deno.test("homecoming scroll returns home and portal returns to fallback tile", () => {
  const world = new World({ seed: 0xC0FFEE });
  const requests = [];
  world.on("homecoming:request", (e) => requests.push(e));
  const spawn = initDungeon(world, { startDepth: 0 });
  const player = createPlayer(world, { x: spawn.x, y: spawn.y, name: "Hero" });

  transitionToDepth(world, 2, { x: 0, y: 0 }, { direction: "down", skipPostTick: true });

  const departure = world.get(player, Position);
  const anchorBlocker = world.create();
  world.add(anchorBlocker, Position, { x: departure.x, y: departure.y });
  world.add(anchorBlocker, Collider, { solid: true, blocksSight: false });

  const inv = world.get(player, Inventory);
  const scroll = createItemById(world, "scroll_homecoming");
  inv.items.push(scroll);
  world.add(player, UseIntent, { itemId: scroll });
  useItemSystem(world);
  flushHomecoming(world, requests);

  const ds = [...world.query(DungeonState)][0][1];
  assertEquals(ds.currentDepth, 0);
  assert(ds.returnPortal?.portalId > 0, "return portal should be created");
  const portalId = ds.returnPortal.portalId;
  const portalPos = world.get(portalId, Position);
  assertEquals(portalPos.x, ds.homeAnchor.x, "portal should be centered at canonical home anchor");
  assertEquals(portalPos.y, ds.homeAnchor.y, "portal should be centered at canonical home anchor");

  world.add(player, InteractIntent, { targetId: portalId });
  interactionSystem(world);

  const dsAfter = [...world.query(DungeonState)][0][1];
  assertEquals(dsAfter.currentDepth, 2);
  const ppos = world.get(player, Position);
  assert(!(ppos.x === departure.x && ppos.y === departure.y), "return should fallback when anchor tile is blocked");
  assert(cheb(ppos, departure) <= 3, "fallback return tile should be within 3 tiles");
});

Deno.test("homecoming scroll emits failure on invalid home anchor", () => {
  const world = new World({ seed: 1234 });
  const requests = [];
  world.on("homecoming:request", (e) => requests.push(e));
  const spawn = initDungeon(world, { startDepth: 0 });
  const player = createPlayer(world, { x: spawn.x, y: spawn.y, name: "Hero" });
  const ds = [...world.query(DungeonState)][0][1];
  ds.homeAnchor = null;

  const inv = world.get(player, Inventory);
  const scroll = createItemById(world, "scroll_homecoming");
  inv.items.push(scroll);

  const failEvents = [];
  world.on("teleport:failed", (e) => failEvents.push(e));

  world.add(player, UseIntent, { itemId: scroll });
  useItemSystem(world);
  flushHomecoming(world, requests);

  assertEquals(failEvents.length, 1);
  assertEquals(failEvents[0].reason, "invalid-home-anchor");
  assert(ds.returnPortal == null, "invalid anchor should not create return portal");
});

Deno.test("homecoming resolves blocked home tile to nearby fallback", () => {
  const world = new World({ seed: 5678 });
  const requests = [];
  world.on("homecoming:request", (e) => requests.push(e));
  const spawn = initDungeon(world, { startDepth: 0 });
  const player = createPlayer(world, { x: spawn.x, y: spawn.y, name: "Hero" });
  const ds = [...world.query(DungeonState)][0][1];

  const blocker = world.create();
  world.add(blocker, Position, { x: ds.homeAnchor.x, y: ds.homeAnchor.y });
  world.add(blocker, Collider, { solid: true, blocksSight: false });

  const inv = world.get(player, Inventory);
  const scroll = createItemById(world, "scroll_homecoming");
  inv.items.push(scroll);
  world.add(player, UseIntent, { itemId: scroll });
  useItemSystem(world);
  flushHomecoming(world, requests);

  const ppos = world.get(player, Position);
  assert(!(ppos.x === ds.homeAnchor.x && ppos.y === ds.homeAnchor.y), "blocked home tile should not be selected");
  assert(cheb(ppos, ds.homeAnchor) <= 3, "fallback home tile should remain within 3 tiles");
});



Deno.test("homecoming works from default start depth with canonical anchor", () => {
  const world = new World({ seed: 2468 });
  const requests = [];
  world.on("homecoming:request", (e) => requests.push(e));
  const spawn = initDungeon(world); // default startDepth 1
  const player = createPlayer(world, { x: spawn.x, y: spawn.y, name: "Hero" });

  const inv = world.get(player, Inventory);
  const scroll = createItemById(world, "scroll_homecoming");
  inv.items.push(scroll);

  world.add(player, UseIntent, { itemId: scroll });
  useItemSystem(world);
  flushHomecoming(world, requests);

  const ds = [...world.query(DungeonState)][0][1];
  assertEquals(ds.currentDepth, 0, "should arrive home even when run starts at depth 1");
  assert(ds.homeAnchor && Number.isInteger(ds.homeAnchor.x) && Number.isInteger(ds.homeAnchor.y), "home anchor should be precomputed");
});


Deno.test("return portal sends player back to exact departure tile when free", () => {
  const world = new World({ seed: 0xBEEF });
  const requests = [];
  world.on("homecoming:request", (e) => requests.push(e));
  const spawn = initDungeon(world, { startDepth: 0 });
  const player = createPlayer(world, { x: spawn.x, y: spawn.y, name: "Hero" });

  transitionToDepth(world, 2, { x: 0, y: 0 }, { direction: "down", skipPostTick: true });
  const departure = world.get(player, Position);

  const inv = world.get(player, Inventory);
  const scroll = createItemById(world, "scroll_homecoming");
  inv.items.push(scroll);
  world.add(player, UseIntent, { itemId: scroll });
  useItemSystem(world);
  flushHomecoming(world, requests);

  const ds = [...world.query(DungeonState)][0][1];
  const portalId = ds.returnPortal.portalId;
  world.add(player, InteractIntent, { targetId: portalId });
  interactionSystem(world);

  const ppos = world.get(player, Position);
  assertEquals(ppos.x, departure.x);
  assertEquals(ppos.y, departure.y);
});
