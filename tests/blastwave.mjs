import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { Terrain } from '../src/rules/components/Terrain.js';
import { Faction } from '../src/rules/components/Faction.js';
import { runSpellScript } from '../src/rules/scripts/spells.js';

function assert(c, m) { if (!c) throw new Error('Assertion failed: ' + m); }

const SPELL = { id: 'blastwave', name: 'Blast Wave', manaCost: 7, script: 'blastwave' };

function makeWall(world, x, y) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Terrain, { walkable: false, opaque: true });
  return id;
}

function makeEntity(world, x, y, hp, faction) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, Vitality, { maxHp: hp, hp });
  if (faction) world.add(id, Faction, { key: faction });
  return id;
}

async function run() {
  // 1. Entity at dist 1 pushed 2 tiles away, entity at dist 2 pushed 1 tile
  {
    const world = new World({ seed: 1 });
    const caster = makeEntity(world, 5, 5, 20, 'player');
    const a = makeEntity(world, 6, 5, 20, 'enemy'); // dist 1
    const b = makeEntity(world, 7, 5, 20, 'enemy'); // dist 2

    runSpellScript(world, caster, SPELL, {});

    const pa = world.get(a, Position);
    const pb = world.get(b, Position);
    assert(pa.x === 8 && pa.y === 5, `1a. dist-1 pushed 2 tiles (got ${pa.x},${pa.y})`);
    assert(pb.x === 8 && pb.y === 5, `1b. dist-2 pushed 1 tile (got ${pb.x},${pb.y})`);
  }

  // 2. Push direction = sign(dx), sign(dy) away from caster
  {
    const world = new World({ seed: 1 });
    const caster = makeEntity(world, 5, 5, 20, 'player');
    const left = makeEntity(world, 4, 5, 20, 'enemy');
    const diag = makeEntity(world, 4, 4, 20, 'enemy'); // dist 1 diagonal

    runSpellScript(world, caster, SPELL, {});

    const pl = world.get(left, Position);
    assert(pl.x === 2 && pl.y === 5, `2a. pushed left by 2 (got ${pl.x},${pl.y})`);
    const pd = world.get(diag, Position);
    assert(pd.x === 2 && pd.y === 2, `2b. pushed diag (-1,-1) by 2 (got ${pd.x},${pd.y})`);
  }

  // 3. Closer = pushed farther (dist 1 → push 2, dist 2 → push 1)
  {
    const world = new World({ seed: 1 });
    const caster = makeEntity(world, 5, 5, 20, 'player');
    const near = makeEntity(world, 5, 4, 20, 'enemy'); // dist 1 north
    const far = makeEntity(world, 5, 3, 20, 'enemy');  // dist 2 north

    runSpellScript(world, caster, SPELL, {});

    const pn = world.get(near, Position);
    assert(pn.y === 2, `3a. dist-1 pushed 2 (got y=${pn.y})`);
    const pf = world.get(far, Position);
    assert(pf.y === 2, `3b. dist-2 pushed 1 (got y=${pf.y})`);
  }

  // 4. Cannot push through walls
  {
    const world = new World({ seed: 1 });
    const caster = makeEntity(world, 5, 5, 20, 'player');
    const target = makeEntity(world, 6, 5, 20, 'enemy'); // dist 1, push right by 2
    makeWall(world, 7, 5); // wall blocks first push step after (6,5)

    runSpellScript(world, caster, SPELL, {});

    const pt = world.get(target, Position);
    assert(pt.x === 6 && pt.y === 5, `4. blocked by wall, stays at (6,5) (got ${pt.x},${pt.y})`);
  }

  // 5. Damage applied, attenuated by distance
  {
    const world = new World({ seed: 1 });
    const caster = makeEntity(world, 5, 5, 20, 'player');
    const near = makeEntity(world, 6, 5, 20, 'enemy'); // dist 1
    const far = makeEntity(world, 7, 5, 20, 'enemy');  // dist 2

    runSpellScript(world, caster, SPELL, {});

    const vn = world.get(near, Vitality);
    const vf = world.get(far, Vitality);
    assert(vn.hp < 20, `5a. near target took damage (hp=${vn.hp})`);
    assert(vf.hp < 20, `5b. far target took damage (hp=${vf.hp})`);
    assert(vn.hp <= vf.hp, `5c. near took more damage than far (${vn.hp} <= ${vf.hp})`);
  }

  // 6. Caster not affected
  {
    const world = new World({ seed: 1 });
    const caster = makeEntity(world, 5, 5, 20, 'player');
    makeEntity(world, 6, 5, 20, 'enemy');

    runSpellScript(world, caster, SPELL, {});

    const vc = world.get(caster, Vitality);
    assert(vc.hp === 20, `6. caster undamaged (hp=${vc.hp})`);
    const pc = world.get(caster, Position);
    assert(pc.x === 5 && pc.y === 5, `6. caster position unchanged (${pc.x},${pc.y})`);
  }

  // 7. spell:blastwave event emitted
  {
    const world = new World({ seed: 1 });
    const events = [];
    world.on('spell:blastwave', (d) => events.push(d));
    const caster = makeEntity(world, 5, 5, 20, 'player');
    makeEntity(world, 6, 5, 20, 'enemy');

    runSpellScript(world, caster, SPELL, {});

    assert(events.length >= 1, '7. spell:blastwave emitted');
  }

  // 8. Kill → died emitted
  {
    const world = new World({ seed: 1 });
    const events = [];
    world.on('died', (d) => events.push(d));
    const caster = makeEntity(world, 5, 5, 20, 'player');
    const weak = makeEntity(world, 6, 5, 1, 'enemy'); // 1 hp, will die

    runSpellScript(world, caster, SPELL, {});

    assert(events.some(e => e.id === weak), '8. died emitted for killed target');
  }

  console.log('Blastwave tests PASS');
}
run().catch(e => { console.error(e); process.exitCode = 1; });
