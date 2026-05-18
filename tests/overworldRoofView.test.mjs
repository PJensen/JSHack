import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { buildWorldView } from "../src/bridge/schema/worldView.js";
import { initDungeon } from "../src/rules/environment/dungeon/index.js";
import { TILE_DOOR, TILE_FLOOR, TILE_GRASS, TILE_WALL } from "../src/rules/environment/dungeon/constants.js";
import { clearAll, setTile, getTile, isRoofed } from "../src/rules/environment/dungeon/tileMap.js";
import { clearExplored } from "../src/rules/environment/dungeon/exploredMap.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { markDestroyedTile } from "../src/rules/utils/destroyedTiles.js";
import { spawnHazard } from "../src/rules/utils/hazardSpawn.js";
import { hazardSystem } from "../src/rules/systems/hazardSystem.js";
import { HazardArea } from "../src/rules/components/HazardArea.js";

function posOfIdentity(world, identity) {
  for (const [, ident, pos] of world.query(NamedIdentity, Position)) {
    if (ident.identity === identity) return { x: pos.x, y: pos.y };
  }
  throw new Error(`missing ${identity}`);
}

function roofHas(view, x, y) {
  return Array.isArray(view.roofs) && view.roofs.some((roof) => roof.x === x && roof.y === y);
}

function roofAt(view, x, y) {
  return Array.isArray(view.roofs) ? view.roofs.find((roof) => roof.x === x && roof.y === y) ?? null : null;
}

function findTavernRoofBreachFixture(anchor) {
  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];
  for (let y = anchor.y - 10; y <= anchor.y + 10; y++) {
    for (let x = anchor.x - 10; x <= anchor.x + 10; x++) {
      if (getTile(x, y) !== TILE_WALL || !isRoofed(x, y)) continue;
      for (const along of dirs) {
        const wall2 = { x: x + along.dx, y: y + along.dy };
        if (getTile(wall2.x, wall2.y) !== TILE_WALL || !isRoofed(wall2.x, wall2.y)) continue;
        for (const inward of dirs) {
          if (inward.dx === along.dx && inward.dy === along.dy) continue;
          if (inward.dx === -along.dx && inward.dy === -along.dy) continue;
          const inside1 = { x: x + inward.dx, y: y + inward.dy };
          const inside2 = { x: wall2.x + inward.dx, y: wall2.y + inward.dy };
          if (getTile(inside1.x, inside1.y) !== TILE_FLOOR || !isRoofed(inside1.x, inside1.y)) continue;
          if (getTile(inside2.x, inside2.y) !== TILE_FLOOR || !isRoofed(inside2.x, inside2.y)) continue;
          return {
            breachWall: { x, y },
            spreadWall: wall2,
            openedRoof: inside1,
            charRoof: inside2,
          };
        }
      }
    }
  }
  throw new Error("missing tavern roof breach fixture");
}

let roofTestChain = Promise.resolve();
function roofTest(name, fn) {
  Deno.test(name, async () => {
    const run = roofTestChain.then(() => fn());
    roofTestChain = run.catch(() => {});
    await run;
  });
}

roofTest("overworld roofs appear from outside and hide only the building the player is inside", async () => {
  clearAll();
  clearExplored();

  const world = new World({ seed: 0xC0FFEE });
  const spawn = await initDungeon(world, { startDepth: 0 });
  const player = world.create();
  world.add(player, Player, {});
  world.add(player, NamedIdentity, { name: "Hero", identity: "player" });
  world.add(player, Position, { x: spawn.x, y: spawn.y });

  const houseInterior = posOfIdentity(world, "cooking_fire");
  const cottageInterior = posOfIdentity(world, "bed_home");
  const tavernInterior = posOfIdentity(world, "tavern_keg");
  const windmillInterior = posOfIdentity(world, "millstone");

  let view = buildWorldView(world);
  assert(roofHas(view, houseInterior.x, houseInterior.y), "house roof should show while the player is outside");
  assert(roofHas(view, cottageInterior.x, cottageInterior.y), "cottage roof should show while the player is outside");
  assert(roofHas(view, tavernInterior.x, tavernInterior.y), "tavern roof should show while the player is outside");
  assert(roofHas(view, windmillInterior.x, windmillInterior.y), "windmill roof should show while the player is outside");
  assert(!view.isVisible?.(houseInterior.x, houseInterior.y), "house interior should still be hidden by walls while the player is outside");
  assert(roofAt(view, houseInterior.x, houseInterior.y)?.alpha === 1, "house roof should still render at full alpha while the shell is visible");

  world.set(player, Position, houseInterior);
  view = buildWorldView(world);
  assert(!roofHas(view, houseInterior.x, houseInterior.y), "house roof should hide when the player steps inside");
  assert(roofHas(view, cottageInterior.x, cottageInterior.y), "cottage roof should remain visible when the player is in the house");
  assert(!roofHas(view, tavernInterior.x, tavernInterior.y), "attached tavern roof should hide with the same roof component");
  assert(roofHas(view, windmillInterior.x, windmillInterior.y), "windmill roof should remain visible when the player is in the house");

  world.set(player, Position, cottageInterior);
  view = buildWorldView(world);
  assert(roofHas(view, houseInterior.x, houseInterior.y), "house roof should reappear when the player leaves it");
  assert(!roofHas(view, cottageInterior.x, cottageInterior.y), "cottage roof should hide when the player steps inside");
  assert(roofHas(view, tavernInterior.x, tavernInterior.y), "tavern roof should remain visible when the player is in the cottage");
  assert(roofHas(view, windmillInterior.x, windmillInterior.y), "windmill roof should remain visible when the player is in the cottage");

  world.set(player, Position, tavernInterior);
  view = buildWorldView(world);
  assert(!roofHas(view, houseInterior.x, houseInterior.y), "attached house roof should hide with the tavern roof component");
  assert(roofHas(view, cottageInterior.x, cottageInterior.y), "cottage roof should reappear when the player leaves it");
  assert(!roofHas(view, tavernInterior.x, tavernInterior.y), "tavern roof should hide when the player steps inside");
  assert(roofHas(view, windmillInterior.x, windmillInterior.y), "windmill roof should remain visible when the player is in the tavern");

  clearAll();
  clearExplored();
});

roofTest("overworld door roof tiles render translucent so entrances read through the roofline", async () => {
  clearAll();
  clearExplored();

  const world = new World({ seed: 0xC0FFEE });
  const spawn = await initDungeon(world, { startDepth: 0 });
  const player = world.create();
  world.add(player, Player, {});
  world.add(player, NamedIdentity, { name: "Hero", identity: "player" });
  world.add(player, Position, { x: spawn.x, y: spawn.y });

  const view = buildWorldView(world);
  const doorRoof = view.roofs.find((roof) => getTile(roof.x, roof.y) === TILE_DOOR);
  assert(doorRoof, "expected at least one rendered roofed door tile on the overworld");
  assertEquals(doorRoof.alpha, 0.4);

  clearAll();
  clearExplored();
});

roofTest("overworld roof shading bands run straight across each building instead of diagonally", async () => {
  clearAll();
  clearExplored();

  const world = new World({ seed: 0xC0FFEE });
  const spawn = await initDungeon(world, { startDepth: 0 });
  const player = world.create();
  world.add(player, Player, {});
  world.add(player, NamedIdentity, { name: "Hero", identity: "player" });
  world.add(player, Position, { x: spawn.x, y: spawn.y });

  const tavernInterior = posOfIdentity(world, "tavern_keg");
  const view = buildWorldView(world);

  const nearbyRows = new Map();
  for (const roof of view.roofs) {
    if (Math.abs(roof.x - tavernInterior.x) > 10 || Math.abs(roof.y - tavernInterior.y) > 8) continue;
    if (!nearbyRows.has(roof.y)) nearbyRows.set(roof.y, []);
    nearbyRows.get(roof.y).push(roof);
  }
  const rows = Array.from(nearbyRows.values()).filter((row) => row.length >= 2);
  assert(rows.length >= 2, "expected multiple nearby roof bands");
  for (const row of rows) {
    const kinds = new Set(row.map((roof) => roof.kind));
    assert(kinds.size <= 2, `roof band at y=${row[0].y} should not fragment into many diagonal bands`);
  }
  assert(new Set(rows.map((row) => row[0].kind)).size >= 2, "nearby roof rows should include distinct lit and shadow bands");

  clearAll();
  clearExplored();
});

roofTest("overworld roofs char and smoke as fire moves through a breached building", async () => {
  clearAll();
  clearExplored();

  const world = new World({ seed: 0xC0FFEE });
  const spawn = await initDungeon(world, { startDepth: 0 });
  const player = world.create();
  world.add(player, Player, {});
  world.add(player, NamedIdentity, { name: "Hero", identity: "player" });
  world.add(player, Position, { x: spawn.x, y: spawn.y });

  const tavernInterior = posOfIdentity(world, "tavern_keg");
  const breach = findTavernRoofBreachFixture(tavernInterior);
  let view = buildWorldView(world);
  assert(roofHas(view, tavernInterior.x, tavernInterior.y), "tavern roof should show before the shell is breached");
  assert(roofHas(view, tavernInterior.x + 6, tavernInterior.y + 4), "rear tavern roof should initially be visible");

  assert(setTile(breach.breachWall.x, breach.breachWall.y, TILE_GRASS), "expected to open a tavern wall to grass");
  markDestroyedTile(world, {
    x: breach.breachWall.x,
    y: breach.breachWall.y,
    originalTile: TILE_WALL,
    currentTile: TILE_GRASS,
    destroyedAtTurn: world.step | 0,
    burnedKind: "wall",
    cause: "wildfire",
  });
  spawnHazard(world, {
    x: breach.breachWall.x,
    y: breach.breachWall.y,
    kind: "fire",
    medium: "floor",
    turnsLeft: 3,
    radius: 0,
    tickDamage: 0,
    damageType: "fire",
    cause: "wildfire",
  });
  // Simulate deterministic fire spread: mark the next wall segment as
  // destroyed in the ledger (without changing the tile) so the adjacent
  // interior roof tile gains a cardinal destroyed neighbour.
  markDestroyedTile(world, {
    x: breach.spreadWall.x,
    y: breach.spreadWall.y,
    originalTile: TILE_WALL,
    currentTile: TILE_WALL,
    destroyedAtTurn: world.step | 0,
    burnedKind: "wall",
    cause: "wildfire",
  });
  view = buildWorldView(world);
  assert(!roofHas(view, breach.openedRoof.x, breach.openedRoof.y), "roof should already be gone where the breach opened");
  assert(String(roofAt(view, breach.charRoof.x, breach.charRoof.y)?.kind || "").includes("charred"), "roof beside the breach should read as charred");
  assertEquals(roofAt(view, breach.charRoof.x, breach.charRoof.y)?.burning, true);
  assert(roofHas(view, tavernInterior.x + 6, tavernInterior.y + 4), "roof should remain over still-enclosed tavern space");

  // Remove all fire hazards to simulate fire burning out completely
  for (const [id,, hazard] of world.query(Position, HazardArea)) {
    if (String(hazard?.kind || "").toLowerCase() === "fire") world.destroy(id);
  }
  view = buildWorldView(world);
  assert(!roofHas(view, breach.charRoof.x, breach.charRoof.y), "roof tile should stop rendering once that section has fully burned through");
  assert(roofHas(view, tavernInterior.x + 6, tavernInterior.y + 4), "distant roof should remain until fire reaches it");

  clearAll();
  clearExplored();
});

roofTest("overworld roof damage persists after nearby fire burns out", async () => {
  clearAll();
  clearExplored();

  const world = new World({ seed: 0xC0FFEE });
  const spawn = await initDungeon(world, { startDepth: 0 });
  const player = world.create();
  world.add(player, Player, {});
  world.add(player, NamedIdentity, { name: "Hero", identity: "player" });
  world.add(player, Position, { x: spawn.x, y: spawn.y });

  const tavernInterior = posOfIdentity(world, "tavern_keg");
  assert(setTile(tavernInterior.x, tavernInterior.y - 1, TILE_GRASS), "expected to open the tavern north wall to grass");
  markDestroyedTile(world, {
    x: tavernInterior.x,
    y: tavernInterior.y - 1,
    originalTile: TILE_WALL,
    currentTile: TILE_GRASS,
    destroyedAtTurn: world.step | 0,
    burnedKind: "wall",
    cause: "wildfire",
  });

  const view = buildWorldView(world);
  const roof = roofAt(view, tavernInterior.x + 1, tavernInterior.y);
  assert(roof, "adjacent roof should remain visible after the fire has finished");
  assert(String(roof.kind || "").includes("charred"), "adjacent roof should stay charred");
  assertEquals(roof.burning, false);

  clearAll();
  clearExplored();
});
