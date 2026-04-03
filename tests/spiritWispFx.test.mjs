import { assert, assertAlmostEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createSpiritWispFxController } from "../src/display/fx/spiritWispFx.js";
import { Position } from "../src/rules/components/Position.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";

function distance(a, b) {
  const dx = Number(a?.x || 0) - Number(b?.x || 0);
  const dy = Number(a?.y || 0) - Number(b?.y || 0);
  return Math.hypot(dx, dy);
}

function setupHarness({ playerStart = { x: 0, y: 0 } } = {}) {
  const world = new World({ seed: 0xC0FFEE });
  const playerId = world.create();
  world.add(playerId, Position, { x: playerStart.x | 0, y: playerStart.y | 0 });

  const controller = createSpiritWispFxController({
    world,
    fx: { pool: { spawn() {} } },
    getPosition: (id) => {
      const p = world.get(Number(id) | 0, Position);
      return p ? { x: Number(p.x), y: Number(p.y) } : null;
    },
    getPlayerEntity: () => (world.isAlive(playerId) ? { id: playerId } : null),
    sampleMood: () => ({
      wrath: 0,
      serenity: 0.8,
      hunger: 0,
      amusement: 0,
      sorrow: 0,
      chaos: 0,
    }),
  });
  controller.installListeners();

  return { world, controller, playerId };
}

Deno.test("spirit circles recently vanquished foes when player lands the kill", () => {
  const { world, controller, playerId } = setupHarness({
    playerStart: { x: 2, y: 2 },
  });
  const foeId = world.create();
  world.add(foeId, Position, { x: 9, y: 2 });

  controller.tick(0.08);
  const before = controller.getWispPos();
  world.emit("died", { id: foeId, killer: playerId });

  for (let i = 0; i < 8; i++) controller.tick(0.1);

  const wisp = controller.getWispPos();
  assert(before && wisp, "wisp should remain active after foe death");
  const foePos = { x: 9, y: 2 };
  assert(
    distance(wisp, foePos) < distance(before, foePos),
    "wisp should bias toward the vanquished foe while circling",
  );
});

Deno.test("spirit fetches nearby death drops before returning to the player", () => {
  const { world, controller } = setupHarness({ playerStart: { x: 0, y: 0 } });
  controller.tick(0.08);

  const itemId = world.create();
  world.add(itemId, Position, { x: 5, y: 0 });
  const before = controller.getWispPos();
  world.emit("item:dropped", {
    actor: 42,
    itemId,
    at: { x: 5, y: 0 },
    source: "death",
  });

  controller.tick(0.12);
  const moved = controller.getWispPos();
  const itemPos = { x: 5, y: 0 };
  assert(before && moved, "wisp should remain active during fetch");
  assert(
    distance(moved, itemPos) < distance(before, itemPos),
    "wisp should move toward dropped loot",
  );

  for (let i = 0; i < 24; i++) controller.tick(0.1);
  const settled = controller.getWispPos();
  assert(settled, "wisp should stay active after item fetch");
  assertAlmostEquals(settled.y, 0, 1.4);
  assert(
    Math.abs(settled.x) < 2.5,
    "wisp should return near the player after fetch",
  );
});

Deno.test("spirit death vigil keeps settling on death tile even if player position disappears", () => {
  const { world, controller, playerId } = setupHarness({
    playerStart: { x: 7, y: 11 },
  });
  controller.tick(0.08);

  world.emit("died", { id: playerId, killer: 0 });
  world.remove(playerId, Position);

  const before = controller.getWispPos();
  controller.tick(0.4);
  controller.tick(0.4);
  const after = controller.getWispPos();

  assert(before && after, "wisp should remain visible during death vigil");
  const deathTile = { x: 7, y: 11 };
  assert(
    distance(after, deathTile) < distance(before, deathTile),
    "wisp should continue settling toward the recorded death tile",
  );
});

Deno.test("spirit circles the corpse before settling onto it", () => {
  const { world, controller, playerId } = setupHarness({
    playerStart: { x: 6, y: 6 },
  });
  controller.tick(0.08);

  world.emit("died", { id: playerId, killer: 0 });
  world.remove(playerId, Position);
  const deathTile = { x: 6, y: 6 };

  controller.tick(0.5);
  const duringCircle = controller.getWispPos();
  assert(duringCircle, "wisp should remain active during corpse circle");
  assert(
    distance(duringCircle, deathTile) > 0.35,
    "wisp should still be circling before final settle",
  );

  for (let i = 0; i < 48; i++) controller.tick(0.2);
  const settled = controller.getWispPos();
  assert(settled, "wisp should remain active after settling");
  assert(
    distance(settled, deathTile) < 0.35,
    "wisp should eventually settle onto the corpse tile",
  );
});

Deno.test("spirit passively acknowledges nearby sacred sites", () => {
  const { world, controller } = setupHarness({ playerStart: { x: 4, y: 4 } });
  const altarId = world.create();
  world.add(altarId, Position, { x: 6, y: 4 });
  world.add(altarId, NamedIdentity, { name: "Altar", identity: "altar" });

  controller.tick(0.1);
  for (let i = 0; i < 20; i++) controller.tick(0.1);

  const wisp = controller.getWispPos();
  assert(wisp, "wisp should remain active near sacred sites");
});

Deno.test("spirit circles revived pet tile after miracle resurrection", () => {
  const { world, controller, playerId } = setupHarness({
    playerStart: { x: 1, y: 1 },
  });
  const petId = world.create();
  world.add(petId, Position, { x: 8, y: 1 });
  world.add(petId, NamedIdentity, { name: "Kitty", identity: "cat" });

  controller.tick(0.1);
  const before = controller.getWispPos();
  world.emit("pet:resurrected", {
    actor: playerId,
    petId,
    at: { x: 8, y: 1 },
  });

  for (let i = 0; i < 6; i++) controller.tick(0.1);
  const after = controller.getWispPos();
  const petPos = { x: 8, y: 1 };

  assert(before && after, "wisp should remain active after pet resurrection");
  assert(
    distance(after, petPos) < distance(before, petPos),
    "wisp should move toward the resurrected pet tile to circle it",
  );
});
