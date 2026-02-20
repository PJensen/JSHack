import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { HazardArea } from "../src/rules/components/HazardArea.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { PlasmaCloud } from "../src/rules/components/PlasmaCloud.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { hazardSystem } from "../src/rules/systems/hazardSystem.js";
import { spawnHazard } from "../src/rules/utils/hazardSpawn.js";
import { spawnPlasmaCloud } from "../src/rules/utils/spawnPlasmaCloud.js";

function makeActor(world, x, y, hp, name = "Target", identity = "target") {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Vitality, { hp, maxHp: Math.max(1, hp) });
  world.add(id, NamedIdentity, { name, identity });
  return id;
}

Deno.test("hazardSystem ticks generic floor hazard and expires it", () => {
  const world = new World({ seed: 9201 });
  const events = [];
  for (const ev of ["hazard:spawned", "hazard:pulse", "hazard:expired"]) {
    world.on(ev, (data) => events.push({ type: ev, ...data }));
  }

  const hazardId = spawnHazard(world, {
    x: 5,
    y: 5,
    kind: "poison",
    medium: "floor",
    turnsLeft: 2,
    radius: 1,
    tickDamage: 2,
    damageType: "poison",
    cause: "toxic_slick",
    sourceKind: "test",
  });
  assert(hazardId > 0, "spawnHazard should return a valid hazard id");

  const center = makeActor(world, 5, 5, 8, "Center");
  const edge = makeActor(world, 6, 5, 8, "Edge");
  const outside = makeActor(world, 7, 5, 8, "Outside");

  hazardSystem(world);
  assertEquals(world.get(center, Vitality).hp, 6);
  assertEquals(world.get(edge, Vitality).hp, 6);
  assertEquals(world.get(outside, Vitality).hp, 8);

  hazardSystem(world);
  assertEquals(world.get(center, Vitality).hp, 4);
  assertEquals(world.get(edge, Vitality).hp, 4);
  assertEquals(world.get(outside, Vitality).hp, 8);
  assert(!world.isAlive(hazardId), "hazard should expire after final pulse");

  const spawned = events.find((e) => e.type === "hazard:spawned");
  assert(spawned, "hazard:spawned should emit");
  assertEquals(spawned.kind, "poison");
  assertEquals(spawned.medium, "floor");

  const pulses = events.filter((e) => e.type === "hazard:pulse");
  assertEquals(pulses.length, 2);
  assertEquals(pulses[0].medium, "floor");
  assertEquals(pulses[0].kind, "poison");
  assertEquals(pulses[0].tickDamage, 2);

  const expired = events.filter((e) => e.type === "hazard:expired");
  assertEquals(expired.length, 1);
  assertEquals(expired[0].medium, "floor");
  assertEquals(expired[0].kind, "poison");
});

Deno.test("plasma spawn remains compatible via generic hazard system", () => {
  const world = new World({ seed: 9202 });
  const events = [];
  for (const ev of [
    "hazard:spawned",
    "hazard:pulse",
    "hazard:expired",
    "plasmaCloud:spawned",
    "plasmaCloud:pulse",
    "plasmaCloud:expired",
  ]) {
    world.on(ev, (data) => events.push({ type: ev, ...data }));
  }

  const cloudId = spawnPlasmaCloud(world, {
    x: 1,
    y: 1,
    turnsLeft: 1,
    radius: 0,
    damage: 1,
    sourceKind: "compat",
  });
  assert(cloudId > 0, "spawnPlasmaCloud should return id");
  assert(world.has(cloudId, HazardArea), "plasma hazard should include HazardArea component");
  assert(world.has(cloudId, PlasmaCloud), "plasma hazard should still include legacy PlasmaCloud component");

  makeActor(world, 1, 1, 4, "Target");
  hazardSystem(world);

  const pulse = events.find((e) => e.type === "hazard:pulse");
  assert(pulse, "hazard pulse should emit");
  assertEquals(pulse.kind, "plasma");
  assertEquals(pulse.medium, "air");

  assert(events.some((e) => e.type === "plasmaCloud:spawned"), "legacy spawned event expected");
  assert(events.some((e) => e.type === "plasmaCloud:pulse"), "legacy pulse event expected");
  assert(events.some((e) => e.type === "plasmaCloud:expired"), "legacy expired event expected");
});
