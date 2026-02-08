import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { Faction } from '../src/rules/components/Faction.js';
import { runSpellScript } from '../src/rules/scripts/spells.js';

function assert(c, m) { if (!c) throw new Error('Assertion failed: ' + m); }

const SPELL = { id: 'meteor', name: 'Meteor', manaCost: 12, script: 'meteor' };

function makeEntity(world, x, y, hp, faction) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Vitality, { maxHp: hp, hp });
  if (faction) world.add(id, Faction, { key: faction });
  return id;
}

async function run() {
  // 1. AoE damage at target position — full damage within radius 1
  {
    const world = new World({ seed: 1 });
    const caster = makeEntity(world, 0, 0, 20, 'player');
    const center = makeEntity(world, 10, 10, 50, 'enemy'); // at impact
    const adj = makeEntity(world, 11, 10, 50, 'enemy'); // dist 1

    runSpellScript(world, caster, SPELL, { x: 10, y: 10 });

    const vc = world.get(center, Vitality);
    const va = world.get(adj, Vitality);
    assert(vc.hp < 50, `1a. center took damage (hp=${vc.hp})`);
    assert(va.hp < 50, `1b. adjacent took damage (hp=${va.hp})`);
    assert(vc.hp === va.hp, `1c. same damage at dist 0 and dist 1 (${vc.hp} === ${va.hp})`);
  }

  // 2. Half damage at radius 2
  {
    const world = new World({ seed: 1 });
    const caster = makeEntity(world, 0, 0, 20, 'player');
    const near = makeEntity(world, 10, 10, 50, 'enemy');  // dist 0
    const far = makeEntity(world, 12, 10, 50, 'enemy');   // dist 2

    runSpellScript(world, caster, SPELL, { x: 10, y: 10 });

    const vn = world.get(near, Vitality);
    const vf = world.get(far, Vitality);
    const nearDmg = 50 - vn.hp;
    const farDmg = 50 - vf.hp;
    assert(nearDmg > 0, `2a. near took damage (${nearDmg})`);
    assert(farDmg > 0, `2b. far took damage (${farDmg})`);
    assert(farDmg < nearDmg, `2c. far took less damage than near (${farDmg} < ${nearDmg})`);
    // Half damage ± 1 for rounding
    assert(Math.abs(farDmg - Math.floor(nearDmg / 2)) <= 1, `2d. far damage ~half of near (${farDmg} vs ${Math.floor(nearDmg/2)})`);
  }

  // 3. No damage beyond radius 2
  {
    const world = new World({ seed: 1 });
    const caster = makeEntity(world, 0, 0, 20, 'player');
    const outside = makeEntity(world, 13, 10, 50, 'enemy'); // dist 3

    runSpellScript(world, caster, SPELL, { x: 10, y: 10 });

    const vo = world.get(outside, Vitality);
    assert(vo.hp === 50, `3. outside radius undamaged (hp=${vo.hp})`);
  }

  // 4. spell:meteor event emitted
  {
    const world = new World({ seed: 1 });
    const events = [];
    world.on('spell:meteor', (d) => events.push(d));
    const caster = makeEntity(world, 0, 0, 20, 'player');
    makeEntity(world, 10, 10, 50, 'enemy');

    runSpellScript(world, caster, SPELL, { x: 10, y: 10 });

    assert(events.length >= 1, '4. spell:meteor emitted');
  }

  console.log('Meteor tests PASS');
}
run().catch(e => { console.error(e); process.exitCode = 1; });
