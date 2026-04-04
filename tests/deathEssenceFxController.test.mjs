import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Position } from "../src/rules/components/Position.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { createDeathEssenceFxController } from "../src/display/fx/deathEssenceFxController.js";

function createHarness() {
  let fxTime = 0;
  return {
    now: () => fxTime,
    advance: (dt) => { fxTime += Number(dt || 0); },
  };
}

Deno.test("death essence: spawns on death and scales with maxHp", () => {
  const world = new World({ seed: 7 });
  const weak = world.create();
  const strong = world.create();
  world.add(weak, Position, { x: 2, y: 3 });
  world.add(strong, Position, { x: 4, y: 3 });
  world.add(weak, Vitality, { hp: 6, maxHp: 6 });
  world.add(strong, Vitality, { hp: 120, maxHp: 120 });

  const harness = createHarness();
  const fx = createDeathEssenceFxController({
    world,
    getFxTime: harness.now,
    getPosition: (id) => world.get(id, Position) || null,
    getEntityIdentity: () => "",
    getEntityVitality: (id) => world.get(id, Vitality) || null,
  });
  fx.installListeners();

  world.emit("died", { id: weak });
  world.emit("died", { id: strong });

  const orbs = fx.getActiveOrbs();
  assertEquals(orbs.length, 2);
  assert(orbs[1].radius > orbs[0].radius, "higher maxHp should produce a larger essence orb");
  assert(orbs[1].glowRadius > orbs[0].glowRadius, "higher maxHp should also increase glow radius");
});

Deno.test("death essence: color comes from palette fg for entity identity", () => {
  const world = new World({ seed: 9 });
  const goblin = world.create();
  world.add(goblin, Position, { x: 8, y: 2 });
  world.add(goblin, NamedIdentity, { name: "Goblin", identity: "goblin" });
  world.add(goblin, Vitality, { hp: 10, maxHp: 10 });

  const harness = createHarness();
  const fx = createDeathEssenceFxController({
    world,
    getFxTime: harness.now,
    getPosition: (id) => world.get(id, Position) || null,
    getEntityIdentity: (id) => String(world.get(id, NamedIdentity)?.identity || ""),
    getEntityVitality: (id) => world.get(id, Vitality) || null,
  });
  fx.installListeners();

  world.emit("died", { id: goblin });

  const orb = fx.getActiveOrbs()[0];
  assert(orb, "orb should exist after death");
  // goblin fg from display/palette/base.js is #7ecc5a
  assertEquals([orb.r, orb.g, orb.b], [126, 204, 90]);
});

Deno.test("death essence: player death also spawns an orb", () => {
  const world = new World({ seed: 11 });
  const player = world.create();
  world.add(player, Position, { x: 1, y: 1 });
  world.add(player, NamedIdentity, { name: "Hero", identity: "player" });

  const harness = createHarness();
  const fx = createDeathEssenceFxController({
    world,
    getFxTime: harness.now,
    getPosition: (id) => world.get(id, Position) || null,
    getEntityIdentity: (id) => String(world.get(id, NamedIdentity)?.identity || ""),
    getEntityVitality: () => null,
  });
  fx.installListeners();

  world.emit("died", { id: player, killer: 0 });
  assertEquals(fx.getActiveOrbs().length, 1);
});
