import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { AttackIntent } from "../src/rules/components/Intents/AttackIntent.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { Vitality } from "../src/rules/components/Vitality.js";
import { Position } from "../src/rules/components/Position.js";
import { Faction } from "../src/rules/components/Faction.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { combatSystem } from "../src/rules/systems/combatSystem.js";
import { installAffixTriggers } from "../src/rules/systems/affixTriggerSystem.js";

/**
 * Integration test: player attacks demon → combatSystem calls dealDamage
 * → dealDamage emits 'damaged' → affixTriggerSystem listener runs
 * runMonsterOnDamaged → demon hellfire retaliates → attacker takes damage.
 *
 * We sweep seeds to find one where the hit lands (not a miss),
 * then verify proc:hellfire fires and attacker HP drops.
 */
Deno.test("demon hellfire retaliation fires through full combat pipeline", () => {
  let found = false;

  for (let seed = 0; seed < 512; seed++) {
    const world = new World({ seed });
    world.step = 1;
    installAffixTriggers(world);

    const attacker = world.create();
    world.add(attacker, Vitality, { maxHp: 50, hp: 50 });
    world.add(attacker, Equipment, { attackDerived: 10, naturalDamageDice: '1d4' });
    world.add(attacker, Position, { x: 5, y: 5 });
    world.add(attacker, Faction, { key: 'player' });

    const demon = world.create();
    world.add(demon, Vitality, { maxHp: 100, hp: 100 });
    world.add(demon, Equipment, { defenseDerived: 0 });
    world.add(demon, Position, { x: 5, y: 6 });
    world.add(demon, Faction, { key: 'enemy' });
    world.add(demon, NamedIdentity, { name: 'Demon', identity: 'demon' });

    const events = [];
    world.on('proc:hellfire', (e) => events.push(e));

    world.add(attacker, AttackIntent, { targetId: demon });
    combatSystem(world);

    const demonVit = world.get(demon, Vitality);
    if (demonVit.hp >= 100) continue; // miss, try next seed

    // Hit landed — hellfire should have fired
    const attackerVit = world.get(attacker, Vitality);
    assert(attackerVit.hp < 50, `seed ${seed}: attacker should take hellfire retaliation damage (hp=${attackerVit.hp})`);
    assert(events.length > 0, `seed ${seed}: proc:hellfire event should be emitted`);
    found = true;
    break;
  }

  assert(found, "expected at least one seed where the melee hit lands and hellfire triggers");
});

Deno.test("skeleton reassemble proc fires through full combat pipeline for some seed", () => {
  let found = false;

  for (let seed = 0; seed < 1024; seed++) {
    const world = new World({ seed });
    world.step = 1;
    installAffixTriggers(world);

    const attacker = world.create();
    world.add(attacker, Vitality, { maxHp: 50, hp: 50 });
    world.add(attacker, Equipment, { attackDerived: 10, naturalDamageDice: '1d4' });
    world.add(attacker, Position, { x: 5, y: 5 });
    world.add(attacker, Faction, { key: 'player' });

    const skeleton = world.create();
    world.add(skeleton, Vitality, { maxHp: 100, hp: 100 });
    world.add(skeleton, Equipment, { defenseDerived: 0 });
    world.add(skeleton, Position, { x: 5, y: 6 });
    world.add(skeleton, Faction, { key: 'enemy' });
    world.add(skeleton, NamedIdentity, { name: 'Skeleton', identity: 'skeleton' });

    const events = [];
    world.on('proc:reassemble', (e) => events.push(e));

    world.add(attacker, AttackIntent, { targetId: skeleton });
    combatSystem(world);

    const skelVit = world.get(skeleton, Vitality);
    if (skelVit.hp >= 100) continue; // miss

    if (events.length > 0) {
      // Reassemble fired — skeleton healed some HP back
      found = true;
      break;
    }
  }

  assert(found, "expected at least one seed where skeleton reassemble proc triggers");
});
