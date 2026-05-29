import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Faction } from "../src/rules/components/Faction.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import {
  classifyActorTargetAction,
  classifyShopClaimOffense,
} from "../src/rules/utils/offenseClassifier.js";

function addFactionActor(world, faction, name) {
  const id = world.create();
  world.add(id, Faction, { key: faction });
  world.add(id, NamedIdentity, { name, identity: name.toLowerCase() });
  return id;
}

Deno.test("actor-target classifier marks direct attacks on social NPCs as confirmable assault", () => {
  const world = new World({ seed: 3101 });
  const player = addFactionActor(world, "player", "Player");
  const villager = addFactionActor(world, "townfolk", "Villager");

  const offense = classifyActorTargetAction(world, {
    actorId: player,
    targetId: villager,
    actionKind: "melee_attack",
  });

  assertEquals(offense.protectedTarget, true);
  assertEquals(offense.offenseKind, "assault");
  assertEquals(offense.severityName, "serious");
  assertEquals(offense.requiresConfirm, true);
});

Deno.test("shop claim classifier maps shop-law reasons into shared offense vocabulary", () => {
  const theft = classifyShopClaimOffense({
    claimKind: "consumed_unpaid",
    reason: "consumption_theft",
    severity: 2,
  });
  const fraud = classifyShopClaimOffense({
    claimKind: "learned_unpaid",
    reason: "knowledge_theft",
    severity: 2,
  });

  assertEquals(theft.source, "shop_law");
  assertEquals(theft.offenseKind, "theft");
  assertEquals(fraud.offenseKind, "fraud");
});
