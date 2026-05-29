import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { getParent } from "../src/lib/ecs-js/hierarchy.js";
import { Faction } from "../src/rules/components/Faction.js";
import { Position } from "../src/rules/components/Position.js";
import { Reputation } from "../src/rules/components/Reputation.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { OFFENSE_KINDS, OFFENSE_SEVERITY, OFFENSE_SOURCES } from "../src/rules/data/offenses.js";
import { applyOffenseDisposition, installDispositionOffenseListeners, shopDispositionTerms } from "../src/rules/utils/disposition.js";
import {
  getReputationRecord,
  installReputationOffenseListeners,
  shopReputationTerms,
} from "../src/rules/utils/reputation.js";
import { recordShopClaim } from "../src/rules/utils/shopClaims.js";

function addActor(world, faction, x = 0, y = 0) {
  const id = world.create();
  world.add(id, Faction, { key: faction });
  world.add(id, Position, { x, y });
  world.add(id, Vitality, { hp: 30, maxHp: 30 });
  return id;
}

Deno.test("witnessed social offense creates scoped public reputation", () => {
  const world = new World({ seed: 4201 });
  const player = addActor(world, "player");
  const shopkeeper = addActor(world, "shopkeeper");
  const witness = addActor(world, "townfolk");
  installReputationOffenseListeners(world);

  applyOffenseDisposition(world, {
    actorId: player,
    victimId: shopkeeper,
    witnessIds: [witness],
    collectWitnesses: false,
    offense: {
      offenseKind: OFFENSE_KINDS.assault,
      severity: OFFENSE_SEVERITY.serious,
      source: OFFENSE_SOURCES.intentionalDirect,
    },
  });

  const town = getReputationRecord(world, player, "town", "overworld");
  const shops = getReputationRecord(world, player, "faction", "shopkeeper");
  assert(town, "town should hold public reputation");
  assert(shops, "shopkeeper faction should hold public reputation");
  assertEquals(town.score, -10);
  assertEquals(shops.score, -10);
  assertEquals(town.band, "suspect");
  assertEquals(getParent(world, town.id), player);
  assertEquals(world.has(town.id, Reputation), true);
});

Deno.test("unwitnessed personal offense does not become public reputation", () => {
  const world = new World({ seed: 4202 });
  const player = addActor(world, "player");
  const villager = addActor(world, "townfolk");
  installReputationOffenseListeners(world);

  applyOffenseDisposition(world, {
    actorId: player,
    victimId: villager,
    witnessIds: [],
    collectWitnesses: false,
    offense: {
      offenseKind: OFFENSE_KINDS.assault,
      severity: OFFENSE_SEVERITY.serious,
      source: OFFENSE_SOURCES.intentionalDirect,
    },
  });

  assertEquals(getReputationRecord(world, player, "town", "overworld"), null);
  assertEquals(getReputationRecord(world, player, "faction", "townfolk"), null);
});

Deno.test("shop-law claims are ledgered public reputation for shopkeepers", () => {
  const world = new World({ seed: 4203 });
  const player = addActor(world, "player");
  const wrongedShopkeeper = addActor(world, "shopkeeper");
  const otherShopkeeper = addActor(world, "shopkeeper");
  installDispositionOffenseListeners(world);
  installReputationOffenseListeners(world);

  recordShopClaim(world, {
    actorId: player,
    shopkeeperId: wrongedShopkeeper,
    amount: 120,
    claimKind: "learned_unpaid",
    reason: "knowledge_theft",
    severity: 2,
  });

  const shops = getReputationRecord(world, player, "faction", "shopkeeper");
  assert(shops, "shop-law reputation should be visible to shopkeepers");
  assertEquals(shops.score, -10);
  assertEquals(shops.band, "suspect");

  const repTerms = shopReputationTerms(world, {
    actorId: player,
    buyMarkup: 1.3,
    sellDiscount: 0.5,
  });
  assertEquals(repTerms.buyMarkup, 1.3650000000000002);
  assertEquals(repTerms.sellDiscount, 0.475);

  const combinedTerms = shopDispositionTerms(world, {
    actorId: player,
    shopkeeperId: otherShopkeeper,
    buyMarkup: 1.3,
    sellDiscount: 0.5,
  });
  assertEquals(combinedTerms.band, "neutral");
  assertEquals(combinedTerms.reputationBand, "suspect");
  assertEquals(combinedTerms.buyMarkup, 1.3650000000000002);
  assertEquals(combinedTerms.sellDiscount, 0.475);
});
