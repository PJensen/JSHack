import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { AggroState, AGGRO_LEVELS } from "../src/rules/components/AggroState.js";
import { AttackIntent } from "../src/rules/components/Intents/AttackIntent.js";
import { MoveIntent } from "../src/rules/components/Intents/MoveIntent.js";
import { Faction } from "../src/rules/components/Faction.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { OFFENSE_KINDS, OFFENSE_SEVERITY } from "../src/rules/data/offenses.js";
import { socialAggroSystem } from "../src/rules/systems/socialAggroSystem.js";
import { applyOffenseDisposition } from "../src/rules/utils/disposition.js";

function addActor(world, faction, x, y, player = false) {
  const id = world.create();
  world.add(id, Faction, { key: faction });
  world.add(id, Position, { x, y });
  world.add(id, Vitality, { hp: 30, maxHp: 30 });
  if (player) world.add(id, Player, {});
  return id;
}

Deno.test("serious offense creates social aggro state for shopkeeper", () => {
  const world = new World({ seed: 4301 });
  const player = addActor(world, "player", 5, 5, true);
  const shopkeeper = addActor(world, "shopkeeper", 6, 5);

  applyOffenseDisposition(world, {
    actorId: player,
    victimId: shopkeeper,
    collectWitnesses: false,
    offense: { offenseKind: OFFENSE_KINDS.assault, severity: OFFENSE_SEVERITY.serious },
  });

  const aggro = world.get(shopkeeper, AggroState);
  assert(aggro, "shopkeeper should receive tactical aggro when furious enough to act");
  assertEquals(aggro.alertLevel, AGGRO_LEVELS.hunting);
  assertEquals(aggro.lastKnownX, 5);
  assertEquals(aggro.lastKnownY, 5);
});

Deno.test("hunting social NPC attacks adjacent player with non-hostile override", () => {
  const world = new World({ seed: 4302 });
  const player = addActor(world, "player", 5, 5, true);
  const villager = addActor(world, "townfolk", 6, 5);
  world.add(villager, AggroState, { alertLevel: AGGRO_LEVELS.hunting, lastKnownX: 5, lastKnownY: 5 });
  world.add(villager, MoveIntent, { dx: 0, dy: 1 });

  socialAggroSystem(world);

  assertEquals(world.has(villager, MoveIntent), false, "social aggro should override ordinary movement");
  const intent = world.get(villager, AttackIntent);
  assert(intent, "adjacent angry villager should attack");
  assertEquals(intent.targetId, player);
  assertEquals(intent.allowNonHostile, true);
});

Deno.test("hunting social NPC paths toward visible non-adjacent player", () => {
  const world = new World({ seed: 4303 });
  addActor(world, "player", 5, 5, true);
  const shopkeeper = addActor(world, "shopkeeper", 8, 5);
  world.add(shopkeeper, AggroState, { alertLevel: AGGRO_LEVELS.hunting, lastKnownX: 5, lastKnownY: 5 });

  socialAggroSystem(world);

  const move = world.get(shopkeeper, MoveIntent);
  assert(move, "shopkeeper should pursue visible player");
  assertEquals(move.dx, -1);
  assertEquals(move.dy, 0);
});

Deno.test("hunting social NPC does not pursue non-adjacent invisible player", () => {
  const world = new World({ seed: 4304 });
  const player = addActor(world, "player", 5, 5, true);
  world.add(player, ActiveEffects, {
    effects: [{ key: "invisible", turnsLeft: 10, potency: 1, stacks: 1 }],
  });
  const shopkeeper = addActor(world, "shopkeeper", 8, 5);
  world.add(shopkeeper, AggroState, { alertLevel: AGGRO_LEVELS.hunting, lastKnownX: 5, lastKnownY: 5 });

  socialAggroSystem(world);

  assertEquals(world.has(shopkeeper, MoveIntent), false);
  assertEquals(world.has(shopkeeper, AttackIntent), false);
});
