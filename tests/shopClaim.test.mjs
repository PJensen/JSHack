import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { getParent } from "../src/lib/ecs-js/hierarchy.js";
import { ShopClaim } from "../src/rules/components/ShopClaim.js";
import { calculateShopDebt } from "../src/rules/utils/shopDebt.js";
import {
  recordShopClaim,
  shopClaimRecords,
  shopIncidentRecords,
} from "../src/rules/utils/shopClaims.js";

Deno.test("shop claim creates the durable claim plus debt and incident projections", () => {
  const world = new World({ seed: 9201 });
  const actor = world.create();
  const shopkeeper = world.create();

  const claims = [];
  const debts = [];
  const incidents = [];
  world.on("shop:claim-recorded", (ev) => claims.push(ev));
  world.on("shop:debt-created", (ev) => debts.push(ev));
  world.on("shop:incident-recorded", (ev) => incidents.push(ev));

  const claim = recordShopClaim(world, {
    actorId: actor,
    shopkeeperId: shopkeeper,
    amount: 120,
    claimKind: "learned_unpaid",
    reason: "knowledge_theft",
    valueKind: "knowledge",
    evidence: "ledger",
  });

  assert(claim && claim.id > 0, "claim should be recorded");
  assert(claim.debt && claim.debt.id > 0, "claim should create payable debt");
  assert(claim.incident && claim.incident.id > 0, "claim should create shop memory");
  assertEquals(calculateShopDebt(world, actor, shopkeeper), 120);

  const comp = world.get(claim.id, ShopClaim);
  assert(comp, "claim entity should have ShopClaim");
  assertEquals(comp.claimKind, "learned_unpaid");
  assertEquals(comp.valueKind, "knowledge");
  assertEquals(comp.debtId, claim.debt.id);
  assertEquals(comp.incidentId, claim.incident.id);
  assertEquals(getParent(world, claim.id), shopkeeper);
  assertEquals(claim.offense.offenseKind, "fraud");
  assertEquals(claim.offense.source, "shop_law");
  assertEquals(claim.incident.offense.offenseKind, "fraud");

  assertEquals(shopClaimRecords(world, shopkeeper).length, 1);
  assertEquals(shopIncidentRecords(world, shopkeeper).length, 1);
  assertEquals(claims.length, 1);
  assertEquals(claims[0].offense.offenseKind, "fraud");
  assertEquals(debts.length, 1);
  assertEquals(incidents.length, 1);
  assertEquals(incidents[0].offense.offenseKind, "fraud");
});

Deno.test("shop claim can record suspicion without forcing payable debt", () => {
  const world = new World({ seed: 9202 });
  const actor = world.create();
  const shopkeeper = world.create();

  const pursuit = [];
  const alarms = [];
  world.on("shop:pursuit-requested", (ev) => pursuit.push(ev));
  world.on("shop:alarm", (ev) => alarms.push(ev));

  const claim = recordShopClaim(world, {
    actorId: actor,
    shopkeeperId: shopkeeper,
    claimKind: "blinked_near_exit_with_stock",
    valueKind: "position",
    evidence: "inference",
    confidence: "suspicious",
    amount: 0,
    createsDebt: false,
    recordIncident: true,
  });

  assert(claim && claim.id > 0, "suspicious claim should be recorded");
  assertEquals(claim.debt, null);
  assert(claim.incident && claim.incident.id > 0, "suspicion should still create memory");
  assertEquals(calculateShopDebt(world, actor, shopkeeper), 0);
  assertEquals(shopClaimRecords(world, shopkeeper).length, 1);
  assertEquals(shopIncidentRecords(world, shopkeeper).length, 1);
  assertEquals(pursuit.length, 0, "suspicion alone should not request pursuit");
  assertEquals(alarms.length, 0, "suspicion alone should not raise alarm");
});

Deno.test("shop claim records payable debt even when shopkeeper entity is not loaded", () => {
  const world = new World({ seed: 9203 });
  const actor = world.create();
  const shopkeeperId = 9001;

  const claim = recordShopClaim(world, {
    actorId: actor,
    shopkeeperId,
    amount: 45,
    claimKind: "consumed_unpaid",
    reason: "consumption_theft",
    valueKind: "consumption",
    evidence: "arcane_mark",
  });

  assert(claim && claim.id > 0, "claim should be recorded");
  assert(claim.debt && claim.debt.id > 0, "debt should not require loaded shopkeeper");
  assertEquals(claim.incident, null, "incident still requires a live shopkeeper memory owner");
  assertEquals(calculateShopDebt(world, actor, shopkeeperId), 45);
  assertEquals(shopClaimRecords(world, shopkeeperId).length, 1);
});
