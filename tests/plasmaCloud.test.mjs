import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { PlasmaCloud } from "../src/rules/components/PlasmaCloud.js";
import { Position } from "../src/rules/components/Position.js";
import { Status } from "../src/rules/components/Status.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { installGridBugDeathClouds } from "../src/rules/systems/gridBugDeathCloudSystem.js";
import { plasmaCloudSystem, spawnPlasmaCloud } from "../src/rules/systems/plasmaCloudSystem.js";

function makeActor(world, x, y, hp, name = "Target", identity = "target") {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Vitality, { hp, maxHp: Math.max(1, hp) });
  world.add(id, NamedIdentity, { name, identity });
  return id;
}

Deno.test("plasma cloud damages all living entities in radius and expires", () => {
  const world = new World({ seed: 123 });
  const events = [];
  for (const ev of ["damage", "died", "plasmaCloud:pulse", "plasmaCloud:expired"]) {
    world.on(ev, (data) => events.push({ type: ev, ...data }));
  }

  const cloudId = spawnPlasmaCloud(world, {
    x: 0,
    y: 0,
    turnsLeft: 2,
    radius: 1,
    damage: 2,
    sourceKind: "test",
  });

  const center = makeActor(world, 0, 0, 5, "Center");
  const edge = makeActor(world, 1, 1, 4, "Edge");
  const outside = makeActor(world, 2, 0, 5, "Outside");
  const dead = makeActor(world, -1, 0, 1, "Dead");
  const deadVit = world.get(dead, Vitality);
  deadVit.hp = 0;

  plasmaCloudSystem(world);
  assertEquals(world.get(center, Vitality).hp, 3);
  assertEquals(world.get(edge, Vitality).hp, 2);
  assertEquals(world.get(outside, Vitality).hp, 5);
  assertEquals(world.get(dead, Vitality).hp, 0);
  assert(world.isAlive(cloudId), "cloud should still exist after first pulse");

  plasmaCloudSystem(world);
  assertEquals(world.get(center, Vitality).hp, 1);
  assertEquals(world.get(edge, Vitality).hp, 0);
  assertEquals(world.get(outside, Vitality).hp, 5);
  assert(!world.isAlive(cloudId), "cloud should expire on final pulse");

  const pulseEvents = events.filter((e) => e.type === "plasmaCloud:pulse");
  const expiredEvents = events.filter((e) => e.type === "plasmaCloud:expired");
  assertEquals(pulseEvents.length, 2);
  assertEquals(expiredEvents.length, 1);
  assert(events.some((e) => e.type === "died" && e.id === edge), "edge target should die on second pulse");
});

Deno.test("plasma cloud respects invulnerable status", () => {
  const world = new World({ seed: 456 });
  const immuneEvents = [];
  world.on("status", (data) => immuneEvents.push(data));

  const target = makeActor(world, 0, 0, 10, "Shielded");
  world.add(target, Status, { statuses: [{ type: "invulnerable", duration: 3, potency: 1, stacks: 1 }] });
  spawnPlasmaCloud(world, { x: 0, y: 0, turnsLeft: 1, radius: 1, damage: 9 });

  plasmaCloudSystem(world);

  assertEquals(world.get(target, Vitality).hp, 10);
  assert(immuneEvents.some((e) => e.id === target && String(e.kind) === "immune"), "immune status event expected");
});

Deno.test("grid bug death installs once and spawns one cloud per bug per step", () => {
  const world = new World({ seed: 789 });
  const spawned = [];
  world.on("plasmaCloud:spawned", (data) => spawned.push(data));

  installGridBugDeathClouds(world);
  installGridBugDeathClouds(world); // idempotent

  const bugId = makeActor(world, 4, 7, 3, "Grid Bug", "grid_bug");
  world.step = 10;
  world.emit("died", { id: bugId });
  world.emit("died", { id: bugId }); // duplicate in same step

  assertEquals(spawned.length, 1);

  let cloudCount = 0;
  for (const _ of world.query(Position, PlasmaCloud)) cloudCount++;
  assertEquals(cloudCount, 1);

  world.step = 11;
  world.emit("died", { id: bugId }); // new step can spawn again
  assertEquals(spawned.length, 2);

  const ratId = makeActor(world, 2, 2, 3, "Rat", "rat");
  world.emit("died", { id: ratId });
  assertEquals(spawned.length, 2);
});
