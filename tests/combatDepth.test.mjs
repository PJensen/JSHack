import { assert } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { ActiveEffects } from "../src/rules/components/ActiveEffects.js";
import { AttackIntent } from "../src/rules/components/Intents/AttackIntent.js";
import { COMBAT_POSTURES } from "../src/rules/components/CombatPosture.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { Facing } from "../src/rules/components/Facing.js";
import { Faction } from "../src/rules/components/Faction.js";
import { ItemInfo } from "../src/rules/components/ItemInfo.js";
import { Position } from "../src/rules/components/Position.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { combatSystem } from "../src/rules/systems/combatSystem.js";
import { resolveCombatSnapshot } from "../src/rules/utils/resolveCombatSnapshot.js";
import { setCombatPosture } from "../src/rules/utils/posture.js";

function makeWeapon(world, { damageType = "slash", damageDice = "1d8", bonuses = {} } = {}) {
  const id = world.create();
  world.add(id, ItemInfo, {
    type: "equip",
    slot: "weapon",
    damageType,
    damageDice,
    count: 1,
    weight: 1,
    value: 0,
    description: "",
    bonuses,
    rarity: 1,
    rarityName: "common",
    affixes: [],
  });
  return id;
}

function makeActor(world, { x, y, hp = 30, faction = "player", facing = null, equipment = {} }) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Vitality, { maxHp: hp, hp });
  world.add(id, Faction, { key: faction });
  world.add(id, Equipment, equipment);
  if (facing) world.add(id, Facing, facing);
  return id;
}

Deno.test("combat posture changes snapshot offense/defense tradeoff", () => {
  const world = new World({ seed: 0xA1 });
  const actor = makeActor(world, {
    x: 1,
    y: 1,
    equipment: { accuracyDerived: 4, evadeDerived: 4, damagePowerDerived: 6 },
  });

  setCombatPosture(world, actor, COMBAT_POSTURES.aggressive);
  const aggressive = resolveCombatSnapshot(world, actor, { mode: "melee" });
  setCombatPosture(world, actor, COMBAT_POSTURES.guarded);
  const guarded = resolveCombatSnapshot(world, actor, { mode: "melee" });

  assert(aggressive.attackBonus > guarded.attackBonus, "aggressive should increase hit chance");
  assert(aggressive.armorClass < guarded.armorClass, "guarded should increase armor class");
  assert(aggressive.damageMult > guarded.damageMult, "aggressive should increase damage mult");
});

Deno.test("rear attack deals more damage than frontal attack", () => {
  function runOne(defenderFacing) {
    const world = new World({ seed: 0xA2 });
    const weapon = makeWeapon(world, {
      damageType: "slash",
      damageDice: "1d8",
      bonuses: { accuracy: 20, damagePower: 8 },
    });
    const attacker = makeActor(world, {
      x: 5, y: 4, faction: "player",
      facing: { dx: 0, dy: 1 },
      equipment: { weapon },
    });
    const defender = makeActor(world, {
      x: 5, y: 5, hp: 40, faction: "enemy", facing: defenderFacing,
      equipment: { evadeDerived: 0 },
    });
    world.add(attacker, AttackIntent, { targetId: defender });
    combatSystem(world);
    return 40 - world.get(defender, Vitality).hp;
  }

  const frontDamage = runOne({ dx: 0, dy: -1 });
  const rearDamage = runOne({ dx: 0, dy: 1 });
  assert(rearDamage > frontDamage, `rear attack should hit harder (front=${frontDamage}, rear=${rearDamage})`);
});

Deno.test("heavy blunt hits apply stagger", () => {
  let validated = false;
  for (let seed = 1; seed <= 64; seed++) {
    const world = new World({ seed });
    const weapon = makeWeapon(world, {
      damageType: "blunt",
      damageDice: "1d10",
      bonuses: { accuracy: 18, damagePower: 12 },
    });
    const attacker = makeActor(world, {
      x: 5, y: 4, faction: "player",
      facing: { dx: 0, dy: 1 },
      equipment: { weapon },
    });
    const defender = makeActor(world, {
      x: 5, y: 5, hp: 40, faction: "enemy", facing: { dx: 0, dy: -1 },
      equipment: { evadeDerived: 0 },
    });
    world.add(attacker, AttackIntent, { targetId: defender });
    combatSystem(world);
    const dmg = 40 - world.get(defender, Vitality).hp;
    if (dmg <= 0) continue;
    const effects = world.get(defender, ActiveEffects)?.effects || [];
    assert(effects.some((e) => String(e?.key || "") === "stagger"), "blunt hit should apply stagger");
    validated = true;
    break;
  }
  assert(validated, "expected at least one deterministic landed blunt hit");
});
