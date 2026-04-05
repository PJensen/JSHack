import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { Facing } from "../src/rules/components/Facing.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { CombatPosture, COMBAT_POSTURES } from "../src/rules/components/CombatPosture.js";
import { Stamina } from "../src/rules/components/Stamina.js";
import { shieldGuardSystem } from "../src/rules/systems/shieldGuardSystem.js";
import { dealDamage } from "../src/rules/utils/dealDamage.js";
import { buildWorldView } from "../src/bridge/schema/worldView.js";

function makeShield(world) {
  const id = world.create();
  world.add(id, NamedIdentity, { name: "Iron Shield", identity: "shield_iron" });
  world.add(id, ItemInfo, {
    type: "equip",
    slot: "offhand",
    subtype: "shield",
    weight: 1,
    value: 0,
    description: "",
    count: 1,
    bonuses: {},
    rarity: 1,
    rarityName: "common",
    affixes: [],
  });
  return id;
}

function makeActor(world, { x, y, hp = 30, facing = null }) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Vitality, { maxHp: hp, hp });
  world.add(id, Equipment, {});
  if (facing) world.add(id, Facing, facing);
  return id;
}

function hasEffect(world, id, key) {
  const ae = world.get(id, ActiveEffects);
  return !!(ae?.effects || []).find((e) => String(e?.key || "") === key && Number(e?.turnsLeft || 0) > 0);
}

Deno.test("shield guard state only exists when a shield is equipped AND in guarded posture", () => {
  const world = new World({ seed: 0x51 });
  const actor = makeActor(world, { x: 3, y: 3 });
  shieldGuardSystem(world);
  assert(!hasEffect(world, actor, "shield_guard"), "no shield, no guard");

  const shield = makeShield(world);
  world.get(actor, Equipment).offhand = shield;
  shieldGuardSystem(world);
  assert(!hasEffect(world, actor, "shield_guard"), "shield but balanced posture = no guard");

  world.add(actor, CombatPosture, { stance: COMBAT_POSTURES.guarded, lastChangedStep: 0, lastMoveStep: -1 });
  shieldGuardSystem(world);
  assert(hasEffect(world, actor, "shield_guard"), "shield + guarded posture = guard");
});

Deno.test("frontal hits chip and then break shield guard (2 stacks)", () => {
  const world = new World({ seed: 0x52 });
  const attacker = makeActor(world, { x: 5, y: 4, hp: 40 });
  const defender = makeActor(world, { x: 5, y: 5, hp: 40, facing: { dx: 0, dy: -1 } });
  const shield = makeShield(world);
  world.get(defender, Equipment).offhand = shield;
  world.add(defender, CombatPosture, { stance: COMBAT_POSTURES.guarded, lastChangedStep: 0, lastMoveStep: -1 });

  shieldGuardSystem(world);
  assert(hasEffect(world, defender, "shield_guard"), "guard should initialize for equipped shield + guarded posture");

  const hpBefore = world.get(defender, Vitality).hp;
  dealDamage(world, { target: defender, source: attacker, amount: 10, type: "physical", cause: "test" });
  const hpAfter1 = world.get(defender, Vitality).hp;
  assert(hpAfter1 > hpBefore - 10, "first guarded hit should mitigate");

  dealDamage(world, { target: defender, source: attacker, amount: 10, type: "physical", cause: "test" });
  assert(!hasEffect(world, defender, "shield_guard"), "guard stacks should be exhausted after 2 hits");
  assert(hasEffect(world, defender, "shield_broken"), "broken state should be applied when stacks are depleted");
});

Deno.test("shield guard state is projected to world view proc badges", () => {
  const world = new World({ seed: 0x53 });
  const actor = makeActor(world, { x: 7, y: 7 });
  const player = makeActor(world, { x: 6, y: 7 });
  world.add(player, Player);
  const shield = makeShield(world);
  world.get(actor, Equipment).offhand = shield;
  world.add(actor, CombatPosture, { stance: COMBAT_POSTURES.guarded, lastChangedStep: 0, lastMoveStep: -1 });
  shieldGuardSystem(world);

  const view = buildWorldView(world);
  const entity = view.entities.find((e) => e.id === actor);
  assert(entity, "actor should appear in world view");
  assert((entity.procStates || []).some((s) => s.key === "shield_guard"), "shield_guard should be exposed as proc state");
});

Deno.test("rear hits bypass shield arc mitigation", () => {
  const world = new World({ seed: 0x54 });
  const frontAttacker = makeActor(world, { x: 5, y: 4, hp: 40 });
  const rearAttacker = makeActor(world, { x: 5, y: 6, hp: 40 });
  const defender = makeActor(world, { x: 5, y: 5, hp: 40, facing: { dx: 0, dy: -1 } });
  const shield = makeShield(world);
  world.get(defender, Equipment).offhand = shield;
  world.add(defender, CombatPosture, { stance: COMBAT_POSTURES.guarded, lastChangedStep: 0, lastMoveStep: -1 });
  shieldGuardSystem(world);

  dealDamage(world, { target: defender, source: frontAttacker, amount: 10, type: "physical", cause: "front" });
  const afterFront = world.get(defender, Vitality).hp;

  const world2 = new World({ seed: 0x54 });
  const rear = makeActor(world2, { x: 5, y: 6, hp: 40 });
  const def2 = makeActor(world2, { x: 5, y: 5, hp: 40, facing: { dx: 0, dy: -1 } });
  const shield2 = makeShield(world2);
  world2.get(def2, Equipment).offhand = shield2;
  world2.add(def2, CombatPosture, { stance: COMBAT_POSTURES.guarded, lastChangedStep: 0, lastMoveStep: -1 });
  shieldGuardSystem(world2);
  dealDamage(world2, { target: def2, source: rear, amount: 10, type: "physical", cause: "rear" });
  const afterRear = world2.get(def2, Vitality).hp;

  const frontDamage = 40 - afterFront;
  const rearDamage = 40 - afterRear;
  assert(rearDamage > frontDamage, "rear attack should bypass shield arc and deal more damage");
  assertEquals(frontDamage, 8, "front shield arc mitigation should apply 20% reduction");
});

// ─── Posture-gated shield guard tests ───────────────────────────────────────

Deno.test("guarded posture without shield gives no shield_guard", () => {
  const world = new World({ seed: 0x55 });
  const actor = makeActor(world, { x: 3, y: 3 });
  world.add(actor, CombatPosture, { stance: COMBAT_POSTURES.guarded, lastChangedStep: 0, lastMoveStep: -1 });
  shieldGuardSystem(world);
  assert(!hasEffect(world, actor, "shield_guard"), "guarded without shield = no guard");
});

Deno.test("switching from guarded to balanced removes shield_guard", () => {
  const world = new World({ seed: 0x56 });
  const actor = makeActor(world, { x: 3, y: 3 });
  const shield = makeShield(world);
  world.get(actor, Equipment).offhand = shield;
  world.add(actor, CombatPosture, { stance: COMBAT_POSTURES.guarded, lastChangedStep: 0, lastMoveStep: -1 });
  shieldGuardSystem(world);
  assert(hasEffect(world, actor, "shield_guard"), "guarded + shield = guard");

  world.get(actor, CombatPosture).stance = COMBAT_POSTURES.balanced;
  shieldGuardSystem(world);
  assert(!hasEffect(world, actor, "shield_guard"), "balanced posture = no guard");
});

Deno.test("shield block drains stamina scaled to damage", () => {
  const world = new World({ seed: 0x57 });
  const attacker = makeActor(world, { x: 5, y: 4, hp: 40 });
  const defender = makeActor(world, { x: 5, y: 5, hp: 40, facing: { dx: 0, dy: -1 } });
  const shield = makeShield(world);
  world.get(defender, Equipment).offhand = shield;
  world.add(defender, CombatPosture, { stance: COMBAT_POSTURES.guarded, lastChangedStep: 0, lastMoveStep: -1 });
  world.add(defender, Stamina, { stamina: 20, maxStamina: 20, regenCooldown: 0 });
  shieldGuardSystem(world);

  const stamBefore = world.get(defender, Stamina).stamina;
  dealDamage(world, { target: defender, source: attacker, amount: 10, type: "physical", cause: "test" });
  const stamAfter = world.get(defender, Stamina).stamina;
  assert(stamAfter < stamBefore, "stamina should drain on shield block");
  // floor(incoming_damage * 0.5) — incoming is 10 (pre-shield-mitigation), so cost = floor(10 * 0.5) = 5
  assertEquals(stamAfter, stamBefore - 5, "stamina cost should be floor(damage * 0.5)");
});
