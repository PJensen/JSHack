// tests/blindness.test.mjs
// Tests for the temporal stat envelope applied to the vision stat.
// Validates: ramp-in / hold / ramp-out phases, getEffectiveVisionRange, blinded status,
// and permanent injury on expiry.

import { assertEquals, assert } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createPlayer } from "../src/rules/archetypes/Player.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { Brain } from "../src/rules/components/Brain.js";
import { Status } from "../src/rules/components/Status.js";
import { effectSystem } from "../src/rules/systems/effectSystem.js";
import {
  blind,
  computeEnvelopeValue,
  getEffectiveVisionRange,
} from "../src/rules/utils/blind.js";

function scheduler(world) {
  try { effectSystem(world); } catch (e) { console.error("effectSystem error:", e); }
}

// ─── Unit tests for computeEnvelopeValue ────────────────────────────────────

Deno.test("computeEnvelopeValue: elapsed=0 returns startValue", () => {
  assertEquals(computeEnvelopeValue(8, 2, 8, 3, 4, 3, 0), 8);
});

Deno.test("computeEnvelopeValue: ramp-in phase interpolates linearly", () => {
  // rampIn=3 → at elapsed=1: t=1/3 → 8 + (2-8)*(1/3) = 8 - 2 = 6
  assertEquals(computeEnvelopeValue(8, 2, 8, 3, 4, 3, 1), 6);
  // at elapsed=2: t=2/3 → 8 + (2-8)*(2/3) = 8 - 4 = 4
  assertEquals(computeEnvelopeValue(8, 2, 8, 3, 4, 3, 2), 4);
});

Deno.test("computeEnvelopeValue: hold phase returns toValue", () => {
  // elapsed=3 (start of hold), elapsed=6 (end of hold)
  assertEquals(computeEnvelopeValue(8, 2, 8, 3, 4, 3, 3), 2);
  assertEquals(computeEnvelopeValue(8, 2, 8, 3, 4, 3, 5), 2);
  assertEquals(computeEnvelopeValue(8, 2, 8, 3, 4, 3, 6), 2);
});

Deno.test("computeEnvelopeValue: ramp-out phase interpolates toward endValue", () => {
  // rampIn=3, hold=4 → ramp-out starts at elapsed=7
  // elapsed=8: t=(8-3-4)/3 = 1/3 → 2 + (8-2)*(1/3) = 2+2 = 4
  assertEquals(computeEnvelopeValue(8, 2, 8, 3, 4, 3, 8), 4);
  // elapsed=9: t=2/3 → 2 + 4 = 6
  assertEquals(computeEnvelopeValue(8, 2, 8, 3, 4, 3, 9), 6);
  // elapsed=10: t=1 → fully recovered = 8
  assertEquals(computeEnvelopeValue(8, 2, 8, 3, 4, 3, 10), 8);
});

Deno.test("computeEnvelopeValue: rampOut=0 snaps immediately to endValue after hold", () => {
  // rampIn=2, hold=0, rampOut=0 → collapses to toValue then snaps to endValue
  assertEquals(computeEnvelopeValue(8, 0, 8, 2, 0, 0, 2), 0);
  assertEquals(computeEnvelopeValue(8, 0, 8, 2, 0, 0, 3), 8); // past total duration
});

Deno.test("computeEnvelopeValue: permanent injury keeps endValue", () => {
  // rampIn=4, hold=0, rampOut=0, endValue=2 — permanent damage
  assertEquals(computeEnvelopeValue(8, 2, 2, 4, 0, 0, 4), 2);
  assertEquals(computeEnvelopeValue(8, 2, 2, 4, 0, 0, 5), 2);
});

// ─── Integration: getEffectiveVisionRange ────────────────────────────────────

Deno.test("getEffectiveVisionRange: returns base vision when no envelope active", () => {
  const world = new World({ seed: 1 });
  const player = createPlayer(world, { name: "Hero" });
  const brain = world.get(player, Brain);
  brain.visionRange = 8;

  assertEquals(getEffectiveVisionRange(world, player), 8);
});

Deno.test("getEffectiveVisionRange: applies blindness immediately on read after application", () => {
  const world = new World({ seed: 101 });
  const player = createPlayer(world, { name: "Hero" });
  const brain = world.get(player, Brain);
  brain.visionRange = 8;

  blind(world, player, 2, 3, 4, 3);

  const vNow = getEffectiveVisionRange(world, player);
  assert(vNow < 8, `vision should be reduced immediately after blind() application; got ${vNow}`);
  assert(vNow >= 2, `vision should not drop below toValue immediately after blind() application; got ${vNow}`);
});

Deno.test("getEffectiveVisionRange: reflects envelope modifier mid-effect", () => {
  const world = new World({ seed: 2 });
  world.setScheduler((w) => scheduler(w));
  const player = createPlayer(world, { name: "Hero" });
  const brain = world.get(player, Brain);
  brain.visionRange = 8;

  // Apply a blind: 3 ticks ramp-in to 2, 4 hold, 3 ramp-out
  blind(world, player, 2, 3, 4, 3);

  // Tick 1: elapsed=0 on this tick (effect just applied, no age yet)
  // effectSystem ages turnsLeft at end of each tick
  world.tick(1);
  // After tick 1: turnsLeft went from 10 to 9, elapsed = 10-9 = 1 (ramp-in phase, t=1/3)
  // modifier = lerp(8,2,1/3) - 8 = (8 - 2) = 6 → 8-6 = 6... wait
  // envelopeValue = 8 + (2-8)*(1/3) = 8 - 2 = 6; modifier = 6 - 8 = -2
  // effectiveVision = 8 + 0 + (-2) = 6
  const v1 = getEffectiveVisionRange(world, player);
  assert(v1 < 8, `vision should be reduced after tick 1, got ${v1}`);
  assert(v1 >= 2, `vision should not go below toValue after tick 1, got ${v1}`);
});

Deno.test("getEffectiveVisionRange: fully impaired during hold phase", () => {
  const world = new World({ seed: 3 });
  world.setScheduler((w) => scheduler(w));
  const player = createPlayer(world, { name: "Hero" });
  const brain = world.get(player, Brain);
  brain.visionRange = 8;

  // rampIn=1, hold=4, rampOut=1
  blind(world, player, 2, 1, 4, 1);

  // Tick 1: ramp-in completes (elapsed=1, turnsLeft=5)
  world.tick(1);
  // Tick 2: hold starts (elapsed=2, turnsLeft=4)
  world.tick(1);
  // Vision should be at toValue=2 during hold
  const vHold = getEffectiveVisionRange(world, player);
  assertEquals(vHold, 2, `vision should be 2 (toValue) during hold; got ${vHold}`);
});

Deno.test("getEffectiveVisionRange: recovers to original after ramp-out", () => {
  const world = new World({ seed: 4 });
  world.setScheduler((w) => scheduler(w));
  const player = createPlayer(world, { name: "Hero" });
  const brain = world.get(player, Brain);
  brain.visionRange = 8;

  // rampIn=1, hold=1, rampOut=1 → total 3 ticks
  blind(world, player, 2, 1, 1, 1);

  // Tick through the whole effect
  world.tick(1); // elapsed=1 ramp-in complete
  world.tick(1); // elapsed=2 hold (1 tick)
  world.tick(1); // elapsed=3 ramp-out complete

  // Effect expires after this (turnsLeft goes to 0)
  world.tick(1); // effect culled

  const vAfter = getEffectiveVisionRange(world, player);
  assertEquals(vAfter, 8, `vision should recover to 8 after effect expires; got ${vAfter}`);
});

// ─── Blinded status reporting ─────────────────────────────────────────────────

Deno.test("effectSystem: reports blinded status while vision is reduced", () => {
  const world = new World({ seed: 5 });
  world.setScheduler((w) => scheduler(w));
  const player = createPlayer(world, { name: "Hero" });
  const brain = world.get(player, Brain);
  brain.visionRange = 8;

  blind(world, player, 2, 1, 2, 1);

  world.tick(1); // after tick 1: ramp-in complete, vision at 2

  const st = world.get(player, Status);
  assert(st?.statuses?.some(s => s.type === 'blinded'), "should have blinded status during effect");
});

Deno.test("effectSystem: blinded status clears after recovery", () => {
  const world = new World({ seed: 6 });
  world.setScheduler((w) => scheduler(w));
  const player = createPlayer(world, { name: "Hero" });
  const brain = world.get(player, Brain);
  brain.visionRange = 8;

  blind(world, player, 2, 1, 1, 1);

  // Run all 3 ticks of the effect
  world.tick(1);
  world.tick(1);
  world.tick(1);
  // Effect expires after tick 3 (turnsLeft → 0, effect culled)
  world.tick(1);

  const st = world.get(player, Status);
  assert(!st?.statuses?.some(s => s.type === 'blinded'), "blinded status should clear after recovery");
});

// ─── Permanent injury ─────────────────────────────────────────────────────────

Deno.test("effectSystem: applies permanent injury to Brain.visionRange on expiry", () => {
  const world = new World({ seed: 7 });
  world.setScheduler((w) => scheduler(w));
  const player = createPlayer(world, { name: "Hero" });
  const brain = world.get(player, Brain);
  brain.visionRange = 8;

  // Permanent: rampIn=2, hold=0, rampOut=0, endValue=3 (different from startValue=8)
  blind(world, player, 3, 2, 0, 0, 3);

  // Tick through both ramp-in ticks
  world.tick(1);
  world.tick(1);
  // Effect expires here; turnsLeft was 2→1→0; on turnsLeft=1 (last tick), injury applied
  world.tick(1);

  // Brain.visionRange should now be permanently 3
  const brainAfter = world.get(player, Brain);
  assertEquals(brainAfter.visionRange, 3, `Brain.visionRange should be 3 after permanent injury; got ${brainAfter.visionRange}`);

  // Effective vision should also reflect the new base
  const vAfter = getEffectiveVisionRange(world, player);
  assertEquals(vAfter, 3, `effective vision should be 3 after permanent injury; got ${vAfter}`);
});

// ─── blind() API boundary checks ──────────────────────────────────────────────

Deno.test("blind: returns false for invalid target", () => {
  const world = new World({ seed: 8 });
  const result = blind(world, 0, 2, 1, 1, 1);
  assert(!result, "blind() should return false for entityId=0");
});

Deno.test("blind: returns false when totalTicks is zero", () => {
  const world = new World({ seed: 9 });
  const player = createPlayer(world, { name: "Hero" });
  const result = blind(world, player, 2, 0, 0, 0);
  assert(!result, "blind() should return false when rampIn+hold+rampOut=0");
});

Deno.test("blind: captures effective vision as startValue including passive bonuses", () => {
  const world = new World({ seed: 10 });
  world.setScheduler((w) => scheduler(w));
  const player = createPlayer(world, { name: "Hero" });
  const brain = world.get(player, Brain);
  brain.visionRange = 8;

  // Apply blind — startValue captured should be 8
  blind(world, player, 2, 3, 4, 3);

  const ae = world.get(player, ActiveEffects);
  const env = ae?.effects?.find(e => e.key === 'stat_envelope');
  assert(env, "stat_envelope effect should be in ActiveEffects");
  assertEquals(env.startValue, 8, `startValue should equal effective vision at time of application (8); got ${env.startValue}`);
  assertEquals(env.toValue, 2, `toValue should be 2`);
  assertEquals(env.rampIn, 3);
  assertEquals(env.hold, 4);
  assertEquals(env.rampOut, 3);
  assertEquals(env.endValue, 8, `endValue should default to startValue (8); got ${env.endValue}`);
  assertEquals(env.turnsLeft, 10, `turnsLeft should be rampIn+hold+rampOut=10; got ${env.turnsLeft}`);
});
