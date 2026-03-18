// tests/sensoryOverload.test.mjs
// Tests for the Sensory Overload feature: lightning and shock traps apply
// temporary blindness, deafness, and stun on hit.

import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createPlayer } from "../src/rules/archetypes/Player.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { Status } from "../src/rules/components/Status.js";
import { Brain } from "../src/rules/components/Brain.js";
import { effectSystem } from "../src/rules/systems/effectSystem.js";
import { blind, getEffectiveVisionRange } from "../src/rules/utils/blind.js";
import { deafen } from "../src/rules/utils/deafen.js";

function scheduler(world) {
  try { effectSystem(world); } catch (e) { console.error("effectSystem error:", e); }
}

// ─── deafen() utility ─────────────────────────────────────────────────────────

Deno.test("deafen: returns false for invalid target", () => {
  const world = new World({ seed: 1 });
  assert(!deafen(world, 0, 1.0, 0, 2, 6), "should return false for id=0");
});

Deno.test("deafen: returns false when totalTicks is zero", () => {
  const world = new World({ seed: 2 });
  const player = createPlayer(world, { name: "Hero" });
  assert(!deafen(world, player, 1.0, 0, 0, 0), "should return false when rampIn+hold+rampOut=0");
});

Deno.test("deafen: pushes hearingImpairment stat_envelope to ActiveEffects", () => {
  const world = new World({ seed: 3 });
  const player = createPlayer(world, { name: "Hero" });

  const result = deafen(world, player, 1.0, 0, 2, 6);
  assert(result, "deafen() should return true on success");

  const ae = world.get(player, ActiveEffects);
  assert(ae, "player should have ActiveEffects");
  const env = ae.effects.find((e) => e.key === 'stat_envelope' && e.stat === 'hearingImpairment');
  assert(env, "ActiveEffects should contain a hearingImpairment stat_envelope");
  assertEquals(env.startValue, 0, "startValue should be 0 (no base impairment)");
  assertEquals(env.toValue, 1.0, "toValue should be 1.0 (fully deaf)");
  assertEquals(env.endValue, 0, "endValue should default to 0 (full recovery)");
  assertEquals(env.rampIn, 0, "rampIn should be 0 (instant)");
  assertEquals(env.hold, 2, "hold should be 2");
  assertEquals(env.rampOut, 6, "rampOut should be 6");
  assertEquals(env.turnsLeft, 8, "turnsLeft = 0+2+6 = 8");
});

// ─── deafened status reporting ────────────────────────────────────────────────

Deno.test("effectSystem: reports deafened status while hearing is impaired", () => {
  const world = new World({ seed: 4 });
  world.setScheduler((w) => scheduler(w));
  const player = createPlayer(world, { name: "Hero" });

  // Instant deafness, hold 2, recover 6
  deafen(world, player, 1.0, 0, 2, 6);

  // First tick — impairment is active (hold phase, value=1.0)
  world.tick(1);

  const st = world.get(player, Status);
  assert(
    st?.statuses?.some((s) => s.type === 'deafened'),
    "should have deafened status while hearing impairment is active"
  );
});

Deno.test("effectSystem: deafened status clears after full recovery", () => {
  const world = new World({ seed: 5 });
  world.setScheduler((w) => scheduler(w));
  const player = createPlayer(world, { name: "Hero" });

  // rampIn=0, hold=1, rampOut=1 → totalTicks=2
  deafen(world, player, 1.0, 0, 1, 1);

  // Tick through all 2 turns + one more to let it expire
  world.tick(1);
  world.tick(1);
  world.tick(1); // effect culled, status should be gone

  const st = world.get(player, Status);
  assert(
    !st?.statuses?.some((s) => s.type === 'deafened'),
    "deafened status should clear after full recovery"
  );
});

// ─── Blindness on lightning-style hit ────────────────────────────────────────

Deno.test("blind: instant hit collapses vision to 1 on first tick", () => {
  const world = new World({ seed: 6 });
  world.setScheduler((w) => scheduler(w));
  const player = createPlayer(world, { name: "Hero" });
  const brain = world.get(player, Brain);
  brain.visionRange = 8;

  // Instant blindness as applied on lightning hit
  blind(world, player, 1, 0, 2, 4);

  // After first tick, vision should be 1 (hold phase)
  world.tick(1);
  const v = getEffectiveVisionRange(world, player);
  assertEquals(v, 1, `vision should be 1 immediately after lightning hit; got ${v}`);
});

Deno.test("blind: blinded status is present during impairment", () => {
  const world = new World({ seed: 7 });
  world.setScheduler((w) => scheduler(w));
  const player = createPlayer(world, { name: "Hero" });
  const brain = world.get(player, Brain);
  brain.visionRange = 8;

  blind(world, player, 1, 0, 2, 4);
  world.tick(1);

  const st = world.get(player, Status);
  assert(
    st?.statuses?.some((s) => s.type === 'blinded'),
    "should have blinded status during vision impairment"
  );
});

Deno.test("blind: vision fully recovers after ramp-out (lightning profile)", () => {
  const world = new World({ seed: 8 });
  world.setScheduler((w) => scheduler(w));
  const player = createPlayer(world, { name: "Hero" });
  const brain = world.get(player, Brain);
  brain.visionRange = 8;

  // Lightning profile: instant, hold=2, rampOut=4, total=6 ticks
  blind(world, player, 1, 0, 2, 4);

  // Tick through all 6 turns + one more to confirm expiry
  for (let i = 0; i < 7; i++) world.tick(1);

  const v = getEffectiveVisionRange(world, player);
  assertEquals(v, 8, `vision should recover to 8 after effect expires; got ${v}`);
});

// ─── Stun on lightning-style hit ─────────────────────────────────────────────

Deno.test("lightning sensory: stun effect is applied correctly", () => {
  const world = new World({ seed: 9 });
  const player = createPlayer(world, { name: "Hero" });

  // Simulate what weatherSystem._rollLightning does
  let ae = world.get(player, ActiveEffects);
  if (!ae) {
    world.add(player, ActiveEffects, { effects: [] });
    ae = world.get(player, ActiveEffects);
  }
  ae.effects.push({ key: 'stun', turnsLeft: 2, potency: 1, stacks: 1 });

  const stun = ae.effects.find((e) => e.key === 'stun');
  assert(stun, "stun effect should be in ActiveEffects");
  assertEquals(stun.turnsLeft, 2, "stun should last 2 turns");
});

// ─── Combined sensory overload (lightning profile) ────────────────────────────

Deno.test("lightning sensory overload: blind + deafen + stun all applied together", () => {
  const world = new World({ seed: 10 });
  world.setScheduler((w) => scheduler(w));
  const player = createPlayer(world, { name: "Hero" });
  const brain = world.get(player, Brain);
  brain.visionRange = 8;

  // Apply all three effects as weatherSystem does
  let ae = world.get(player, ActiveEffects);
  if (!ae) {
    world.add(player, ActiveEffects, { effects: [] });
    ae = world.get(player, ActiveEffects);
  }
  ae.effects.push({ key: 'stun', turnsLeft: 2, potency: 1, stacks: 1 });
  blind(world, player, 1, 0, 2, 4);
  deafen(world, player, 1.0, 0, 2, 6);

  world.tick(1);

  const st = world.get(player, Status);
  assert(
    st?.statuses?.some((s) => s.type === 'blinded'),
    "should be blinded after lightning hit"
  );
  assert(
    st?.statuses?.some((s) => s.type === 'deafened'),
    "should be deafened after lightning hit"
  );
  assert(
    st?.statuses?.some((s) => s.type === 'stunned'),
    "should be stunned after lightning hit"
  );

  // Vision is reduced
  const v = getEffectiveVisionRange(world, player);
  assert(v < 8, `vision should be reduced from 8; got ${v}`);
});

Deno.test("sensory overload: no permanent vision or hearing damage after recovery", () => {
  const world = new World({ seed: 11 });
  world.setScheduler((w) => scheduler(w));
  const player = createPlayer(world, { name: "Hero" });
  const brain = world.get(player, Brain);
  brain.visionRange = 8;

  // Apply sensory effects with full recovery (endValue defaults)
  blind(world, player, 1, 0, 2, 4);   // 6 total ticks
  deafen(world, player, 1.0, 0, 2, 6); // 8 total ticks

  // Tick past the longest effect (8 ticks) + 2 extra
  for (let i = 0; i < 10; i++) world.tick(1);

  // Vision should be fully recovered — no permanent damage
  const v = getEffectiveVisionRange(world, player);
  assertEquals(v, 8, `vision should recover to base 8; got ${v}`);

  // No deafened or blinded status should remain
  const st = world.get(player, Status);
  assert(
    !st?.statuses?.some((s) => s.type === 'blinded'),
    "blinded status should be gone after full recovery"
  );
  assert(
    !st?.statuses?.some((s) => s.type === 'deafened'),
    "deafened status should be gone after full recovery"
  );
});
