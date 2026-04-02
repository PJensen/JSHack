import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { HazardArea } from "../src/rules/components/HazardArea.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { installMonsterDeathHooks } from "../src/rules/systems/monsterDeathHookSystem.js";
import { hazardSystem } from "../src/rules/systems/hazardSystem.js";
import { dealDamage } from "../src/rules/utils/dealDamage.js";

function makeGridBug(world, x, y, hp = 3) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Vitality, { hp, maxHp: Math.max(1, hp) });
  world.add(id, NamedIdentity, { name: "Grid Bug", identity: "grid_bug" });
  return id;
}

// Test: Does the cloud spawn when the bug is killed via dealDamage outside a tick?
Deno.test("grid_bug: onDeath cloud spawns via dealDamage (no tick)", () => {
  const world = new World({ seed: 1234 });
  installMonsterDeathHooks(world);

  const spawned = [];
  world.on("hazard:spawned", (e) => spawned.push(e));

  const bugId = makeGridBug(world, 5, 5);
  dealDamage(world, { target: bugId, amount: 999, type: "physical", source: 0, bypassResist: true });

  assertEquals(spawned.length, 1, "cloud should spawn on grid bug death");
  assertEquals(spawned[0].at.x, 5);
  assertEquals(spawned[0].at.y, 5);

  let cloudCount = 0;
  for (const _ of world.query(Position, HazardArea)) {
    cloudCount++;
  }
  assertEquals(cloudCount, 1, "one HazardArea entity should exist");
});

// Test: Does the cloud spawn when the bug is killed DURING a tick?
Deno.test("grid_bug: onDeath cloud spawns when killed during world.tick()", () => {
  const world = new World({ seed: 5678 });
  installMonsterDeathHooks(world);

  const spawned = [];
  world.on("hazard:spawned", (e) => spawned.push(e));

  const bugId = makeGridBug(world, 7, 9);

  // Simulate killing the bug inside a tick by setting up a scheduler
  world.setScheduler((w, _dt) => {
    dealDamage(w, { target: bugId, amount: 999, type: "physical", source: 0, bypassResist: true });
  });

  world.tick(1); // kills the bug inside the scheduler (during _inTick=true)

  // After tick, deferred commands should have been flushed
  // The hazard:spawned event fires synchronously (even during tick)
  assertEquals(spawned.length, 1, "hazard:spawned event should have fired");
  assertEquals(spawned[0].at.x, 7);
  assertEquals(spawned[0].at.y, 9);

  // The HazardArea entity should have been created and components applied
  let cloudCount = 0;
  let cloudId = 0;
  for (const [id, _pos, _hz] of world.query(Position, HazardArea)) {
    cloudCount++;
    cloudId = id;
  }
  assertEquals(cloudCount, 1, "HazardArea entity should exist after tick flush");

  // Verify the HazardArea has the right damage params
  const hz = world.get(cloudId, HazardArea);
  assert(hz !== null, "HazardArea component should be set");
  assertEquals(hz.turnsLeft, 6, "turnsLeft should be 6");
  assertEquals(hz.radius, 1, "radius should be 1");
  assertEquals(hz.tickDamage, 2, "damage should be 2");
});

// Test: Does the cloud deal damage the turn after it spawns?
Deno.test("grid_bug: cloud deals damage on next tick after spawn", () => {
  const world = new World({ seed: 9012 });
  installMonsterDeathHooks(world);

  const bugId = makeGridBug(world, 3, 3);

  // Create a target entity that should be damaged by the cloud
  const targetId = world.create();
  world.add(targetId, Position, { x: 3, y: 3 }); // same tile as bug
  world.add(targetId, Vitality, { hp: 20, maxHp: 20 });

  // Tick 1: kill the bug
  world.setScheduler((w, _dt) => {
    dealDamage(w, { target: bugId, amount: 999, type: "physical", source: 0, bypassResist: true });
  });
  world.tick(1);

  // Target should NOT be damaged yet (cloud processes on next tick)
  const vitAfterTick1 = world.get(targetId, Vitality);
  assertEquals(vitAfterTick1.hp, 20, "target should not take damage on spawn tick");

  // Tick 2: hazardSystem processes the cloud
  world.setScheduler((w, _dt) => {
    hazardSystem(w);
  });
  world.tick(1);

  const vitAfterTick2 = world.get(targetId, Vitality);
  assert(vitAfterTick2.hp < 20, `target should take damage from cloud on tick 2 (hp=${vitAfterTick2.hp})`);
});
