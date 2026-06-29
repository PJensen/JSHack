import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert";
import "./helpers/installContentCatalog.mjs";

import { World } from "../src/lib/ecs-js/index.js";
import { registerBuiltinCommands } from "../src/main/debug/consoleCommands.js";
import { createTransitionController } from "../src/main/wiring/transitionWiring.js";
import { installContent } from "../src/content/install.js";
import "../src/content/interactables/index.js";
import { InteractionSystem } from "../src/rules/systems/interactionSystem.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Interactable } from "../src/rules/components/Interactable.js";
import { RiftPortal } from "../src/rules/components/RiftPortal.js";
import { RiftState } from "../src/rules/components/RiftState.js";
import { RiftEnterRequested } from "../src/events/RiftEnterRequested.js";
import { RiftCloseRequested } from "../src/events/RiftCloseRequested.js";
import { RiftEntered } from "../src/events/RiftEntered.js";
import { RiftExited } from "../src/events/RiftExited.js";
import { RiftClosed } from "../src/events/RiftClosed.js";
import { clearAll as clearTileMap, setTile } from "../src/rules/environment/dungeon/tileMap.js";
import { TILE_FLOOR } from "../src/rules/environment/dungeon/constants.js";
import { clearFloorCache } from "../src/rules/environment/dungeon/transition.js";
import { playerEntity } from "../src/rules/utils/queries.js";
import { resolveInteractableAffordance } from "../src/rules/interaction/interactableAffordance.js";

function floorPatch(cx = 5, cy = 5, radius = 4) {
  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) setTile(x, y, TILE_FLOOR);
  }
}

function makeWorld(depth = 0) {
  clearTileMap();
  floorPatch();
  const world = new World({ seed: 0x5151 });
  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });
  const ds = world.create();
  world.add(ds, DungeonState, {
    worldSeed: world.seed >>> 0,
    currentDepth: depth,
    profileType: depth === 0 ? "overworld" : "default",
    floorEntityIds: [],
    downStairPositions: [],
  });
  return { world, player };
}

function commandMap(world) {
  const commands = new Map();
  registerBuiltinCommands({
    registerCommand(name, helpText, handler) {
      commands.set(name, { helpText, handler });
    },
    log() {},
  }, {
    world,
    messageLog: { log() {} },
  });
  return commands;
}

Deno.test("debug create/close rift keeps return portals separate", () => {
  const { world } = makeWorld(0);
  const returnPortal = world.create();
  world.add(returnPortal, Position, { x: 6, y: 5 });
  world.add(returnPortal, NamedIdentity, { name: "Return Portal", identity: "return_portal" });
  world.add(returnPortal, Interactable, {
    action: "returnPortal",
    params: { targetDepth: 0, targetX: 5, targetY: 5 },
  });

  const closed = [];
  world.on(RiftClosed, (event) => closed.push(event));

  const commands = commandMap(world);
  const create = commands.get("create");
  const close = commands.get("close");
  assert(create, "create command should be registered");
  assert(close, "close command should be registered");

  const created = create.handler("rift 3");
  assertStringIncludes(created, "Created rift");
  assertStringIncludes(created, "levels=3");

  const riftPortals = [...world.query(RiftPortal)];
  assertEquals(riftPortals.length, 1);
  const [portalId, portal] = riftPortals[0];
  assertEquals(portal.levels, 3);
  assertEquals(world.get(portalId, NamedIdentity)?.identity, "rift_portal");
  assert(world.isAlive(returnPortal), "return portal should coexist with rift portal");

  assertEquals(create.handler("rift 2"), "A rift is already active. Use close rift first.");
  const closedText = close.handler("rift");
  assertStringIncludes(closedText, "Closed rift");
  assertEquals([...world.query(RiftPortal)].length, 0);
  assertEquals([...world.query(RiftState)].length, 0);
  assert(world.isAlive(returnPortal), "close rift must not destroy return_portal");
  assertEquals(closed.length, 1);
});

Deno.test("create rift 0 resolves a deterministic default level count", () => {
  const a = makeWorld(0).world;
  const b = makeWorld(0).world;
  commandMap(a).get("create").handler("rift 0");
  commandMap(b).get("create").handler("rift 0");
  const levelsA = [...a.query(RiftState)][0][1].levels;
  const levelsB = [...b.query(RiftState)][0][1].levels;
  assertEquals(levelsA, levelsB);
  assert(levelsA >= 2 && levelsA <= 5, `expected default rift levels in [2,5], got ${levelsA}`);
});

Deno.test("rift portal exposes authored generic interactable affordance", () => {
  installContent();
  const { world } = makeWorld(0);
  commandMap(world).get("create").handler("rift 2");
  const [portalId] = [...world.query(RiftPortal)][0];

  const affordance = resolveInteractableAffordance(world, portalId);
  assertEquals(affordance?.targetId, portalId);
  assertEquals(affordance?.action, "riftPortal");
  assertEquals(affordance?.title, "Rift Portal");
  assertEquals(affordance?.label, "Enter Rift");
});

Deno.test("rift portal interaction emits only a rift enter request", () => {
  installContent();
  const { world, player } = makeWorld(0);
  commandMap(world).get("create").handler("rift 2");
  const [portalId, portal] = [...world.query(RiftPortal)][0];
  const requested = [];
  const returns = [];
  world.on(RiftEnterRequested, (event) => requested.push(event));
  world.on("portal:return", (event) => returns.push(event));

  assertEquals(InteractionSystem(world, player, portalId, null), true);
  assertEquals(requested.length, 1);
  assertEquals(requested[0].riftId, portal.riftId);
  assertEquals(returns.length, 0);
});

Deno.test("rift enter and close use a detached plane and return to origin", async () => {
  installContent();
  clearFloorCache();
  const originalNow = Date.now;
  let now = 10_000;
  Date.now = () => now;

  try {
    const { world } = makeWorld(1);
    commandMap(world).get("create").handler("rift 2");
    const [portalId, portal] = [...world.query(RiftPortal)][0];
    const entered = [];
    const exited = [];
    const closed = [];
    world.on(RiftEntered, (event) => entered.push(event));
    world.on(RiftExited, (event) => exited.push(event));
    world.on(RiftClosed, (event) => closed.push(event));

    const controller = createTransitionController({
      world,
      playerEntity: () => playerEntity(world),
      tombstoneRepo: null,
      onTransitioned() {},
    });
    controller.install();

    world.emit(new RiftEnterRequested({ actor: playerEntity(world).id, portalId, riftId: portal.riftId }));
    await controller.flush();

    let ds = [...world.query(DungeonState)][0][1];
    let state = [...world.query(RiftState)][0][1];
    assertEquals(ds.currentDepth, 1);
    assertEquals(ds.activePlaneId, state.planeId);
    assertEquals(ds.activePlaneId, `rift:${portal.riftId}`);
    assertEquals(state.inside, true);
    assertEquals(state.currentLevel, 1);
    assertEquals(entered.length, 1);

    now += 1_000;
    world.emit(new RiftCloseRequested({ actor: playerEntity(world).id, riftId: portal.riftId }));
    await controller.flush();

    ds = [...world.query(DungeonState)][0][1];
    assertEquals(ds.currentDepth, 1);
    assertEquals(ds.activePlaneId, "");
    assertEquals([...world.query(RiftState)].length, 0);
    assertEquals([...world.query(RiftPortal)].length, 0);
    assertEquals(exited.length, 1);
    assertEquals(closed.length, 1);
  } finally {
    Date.now = originalNow;
    clearFloorCache();
    clearTileMap();
  }
});
