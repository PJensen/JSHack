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
import { applyElectrocuted } from "../src/rules/utils/electrocute.js";
import { installElectrocuteOnDamage } from "../src/rules/utils/electrocute.js";
import { dealDamage } from "../src/rules/utils/dealDamage.js";
import { trapSystem } from "../src/rules/systems/trapSystem.js";
import { Trap } from "../src/rules/components/Trap.js";
import { Position } from "../src/rules/components/Position.js";
import "../src/rules/scripts/traps.js";

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

Deno.test("blind: instant hit collapses vision to 0 on first tick", () => {
  const world = new World({ seed: 6 });
  world.setScheduler((w) => scheduler(w));
  const player = createPlayer(world, { name: "Hero" });
  const brain = world.get(player, Brain);
  brain.visionRange = 8;

  // Instant blindness as applied on lightning hit
  blind(world, player, 0, 0, 2, 4);

  // After first tick, vision should be 0 (hold phase — fully blind)
  world.tick(1);
  const v = getEffectiveVisionRange(world, player);
  assertEquals(v, 0, `vision should be 0 immediately after lightning hit; got ${v}`);
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

Deno.test("applyElectrocuted: returns false for invalid target", () => {
  const world = new World({ seed: 9 });
  assert(!applyElectrocuted(world, 0), "should return false for entityId=0");
});

Deno.test("applyElectrocuted: pushes stun, visionRange envelope, and hearingImpairment envelope", () => {
  const world = new World({ seed: 9 });
  const player = createPlayer(world, { name: "Hero" });

  const result = applyElectrocuted(world, player);
  assert(result, "applyElectrocuted should return true");

  const ae = world.get(player, ActiveEffects);
  assert(ae, "player should have ActiveEffects");
  assert(ae.effects.some((e) => e.key === 'stun' && e.turnsLeft === 2), "stun effect should be present with turnsLeft=2");
  assert(ae.effects.some((e) => e.key === 'stat_envelope' && e.stat === 'visionRange'), "vision envelope should be present");
  assert(ae.effects.some((e) => e.key === 'stat_envelope' && e.stat === 'hearingImpairment'), "hearing envelope should be present");
});

// ─── Combined sensory overload (canonical applyElectrocuted) ─────────────────

Deno.test("applyElectrocuted: blind + deafen + stun all reported after first tick", () => {
  const world = new World({ seed: 10 });
  world.setScheduler((w) => scheduler(w));
  const player = createPlayer(world, { name: "Hero" });
  const brain = world.get(player, Brain);
  brain.visionRange = 8;

  // Canonical electrocution path used by weather and shock trap
  applyElectrocuted(world, player);

  world.tick(1);

  const st = world.get(player, Status);
  assert(
    st?.statuses?.some((s) => s.type === 'blinded'),
    "should be blinded after electrocution"
  );
  assert(
    st?.statuses?.some((s) => s.type === 'deafened'),
    "should be deafened after electrocution"
  );
  assert(
    st?.statuses?.some((s) => s.type === 'stunned'),
    "should be stunned after electrocution"
  );

  // Vision is fully collapsed to 0
  const v = getEffectiveVisionRange(world, player);
  assertEquals(v, 0, `vision should be 0 after electrocution; got ${v}`);
});

Deno.test("sensory overload: no permanent vision or hearing damage after recovery", () => {
  const world = new World({ seed: 11 });
  world.setScheduler((w) => scheduler(w));
  const player = createPlayer(world, { name: "Hero" });
  const brain = world.get(player, Brain);
  brain.visionRange = 8;

  // Apply via canonical path
  applyElectrocuted(world, player);

  // Tick past the longest effect (hearingImpairment: 18 ticks) + 2 extra
  for (let i = 0; i < 20; i++) world.tick(1);

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

Deno.test("lightning damage blinds immediately (effective sight is 0 before tick)", () => {
  const world = new World({ seed: 12 });
  const player = createPlayer(world, { name: "Hero" });
  const brain = world.get(player, Brain);
  brain.visionRange = 8;
  installElectrocuteOnDamage(world);

  dealDamage(world, {
    target: player,
    amount: 5,
    type: "lightning",
    cause: "test:lightning",
  });

  const vNow = getEffectiveVisionRange(world, player);
  assertEquals(vNow, 0, `lightning damage should blind immediately; got ${vNow}`);
});

Deno.test("shock trap blinds immediately (effective sight is 0 on trigger)", () => {
  const world = new World({ seed: 13 });
  const player = createPlayer(world, { name: "Hero" });
  const brain = world.get(player, Brain);
  brain.visionRange = 8;
  world.set(player, Position, { x: 4, y: 4 });
  installElectrocuteOnDamage(world);

  const trap = world.create();
  world.add(trap, Position, { x: 4, y: 4 });
  world.add(trap, Trap, {
    type: "shock",
    armed: true,
    revealed: false,
    script: "trap_shock",
    params: { percent: 0.15 },
    difficulty: 21,
  });

  trapSystem(world);

  const vNow = getEffectiveVisionRange(world, player);
  assertEquals(vNow, 0, `shock trap should blind immediately; got ${vNow}`);
});
