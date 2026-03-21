// tests/aiCorpseEat.test.mjs
// Monsters with corpseEat config consume floor corpses for healing or overhealth.

import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position }      from '../src/rules/components/Position.js';
import { Player }        from '../src/rules/components/Player.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { Faction }       from '../src/rules/components/Faction.js';
import { Vitality }      from '../src/rules/components/Vitality.js';
import { Speed }         from '../src/rules/components/Speed.js';
import { ItemInfo }      from '../src/rules/components/ItemInfo.js';
import { Consumable }    from '../src/rules/components/Consumable.js';
import { FoodDecay }     from '../src/rules/components/FoodDecay.js';
import { Pet }           from '../src/rules/components/Pet.js';
import { MoveIntent }    from '../src/rules/components/Intents/MoveIntent.js';
import { AggroState, AGGRO_LEVELS } from '../src/rules/components/AggroState.js';
import { aiCorpseEatSystem } from '../src/rules/systems/aiCorpseEatSystem.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeWorld(seed = 1) {
  const world = new World({ seed });
  world.step = 0;
  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });
  return world;
}

function placeCorpse(world, x, y, nutrition = 200) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, ItemInfo, {
    type: 'food', slot: 'none', weight: 5, value: 0,
    description: 'A corpse.', count: 1, bonuses: {},
    twoHanded: false, rarity: 1, rarityName: 'common', affixes: [],
  });
  world.add(id, NamedIdentity, { name: 'Goblin Corpse', identity: 'corpse_goblin' });
  world.add(id, Consumable, { effectParams: { nutrition }, remainingUses: 1, potency: 0 });
  world.add(id, FoodDecay, { turnsHeld: 0, shelfLife: 150 });
  return id;
}

function placeMonster(world, x, y, identity, { alertLevel, hp, maxHp } = {}) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, NamedIdentity, { name: identity, identity });
  world.add(id, Faction, { key: 'enemy' });
  world.add(id, Vitality, { hp: hp ?? 5, maxHp: maxHp ?? 10 });
  world.add(id, Speed, { actEvery: 1 });
  world.add(id, AggroState, {
    alertLevel: alertLevel ?? AGGRO_LEVELS.unaware,
    lastKnownX: 0, lastKnownY: 0,
    searchTurnsLeft: 0,
    retreating: false,
  });
  return id;
}

// ── Scavenge tests ───────────────────────────────────────────────────────────

Deno.test("scavenge: rat eats corpse when HP below threshold", () => {
  const world = makeWorld(1);
  const rat = placeMonster(world, 8, 5, 'rat', { hp: 2, maxHp: 5 });
  const corpse = placeCorpse(world, 8, 5, 200);

  aiCorpseEatSystem(world);

  assert(!world.isAlive(corpse), 'corpse should be destroyed');
  const vit = world.get(rat, Vitality);
  assert(vit.hp > 2, 'rat should have healed');
});

Deno.test("scavenge: rat does NOT eat when HP is above threshold", () => {
  const world = makeWorld(2);
  // rat threshold is 0.60 → 4/5 = 0.80, above threshold
  placeMonster(world, 8, 5, 'rat', { hp: 4, maxHp: 5 });
  const corpse = placeCorpse(world, 8, 5, 200);

  aiCorpseEatSystem(world);

  assert(world.isAlive(corpse), 'corpse should remain — rat not hurt enough');
});

Deno.test("scavenge: goblin eats adjacent corpse (not just same tile)", () => {
  const world = makeWorld(3);
  const goblin = placeMonster(world, 8, 5, 'goblin', { hp: 3, maxHp: 8 });
  const corpse = placeCorpse(world, 9, 5, 200); // 1 tile east

  aiCorpseEatSystem(world);

  assert(!world.isAlive(corpse), 'corpse should be destroyed');
  const vit = world.get(goblin, Vitality);
  assert(vit.hp > 3, 'goblin should have healed');
});

// ── Devour tests ─────────────────────────────────────────────────────────────

Deno.test("devour: troll eats corpse and gains overhealth above maxHp", () => {
  const world = makeWorld(4);
  const troll = placeMonster(world, 8, 5, 'troll', { hp: 25, maxHp: 25 });
  const corpse = placeCorpse(world, 8, 5, 400);

  aiCorpseEatSystem(world);

  assert(!world.isAlive(corpse), 'corpse should be destroyed');
  const vit = world.get(troll, Vitality);
  assert(vit.hp > 25, `troll should have overhealth, got ${vit.hp}`);
});

Deno.test("devour: overhealth capped at 150% of maxHp", () => {
  const world = makeWorld(5);
  const troll = placeMonster(world, 8, 5, 'troll', { hp: 25, maxHp: 25 });
  // Massive nutrition → should still cap
  const corpse = placeCorpse(world, 8, 5, 90000);

  aiCorpseEatSystem(world);

  assert(!world.isAlive(corpse), 'corpse should be destroyed');
  const vit = world.get(troll, Vitality);
  assert(vit.hp <= Math.floor(25 * 1.5), `overhealth should be capped at 150%, got ${vit.hp}`);
});

Deno.test("devour: carrion shade eats corpse at full HP (no hp threshold)", () => {
  const world = makeWorld(6);
  const shade = placeMonster(world, 8, 5, 'carrion_shade', { hp: 20, maxHp: 20 });
  const corpse = placeCorpse(world, 8, 5, 200);

  aiCorpseEatSystem(world);

  assert(!world.isAlive(corpse), 'corpse should be destroyed');
  const vit = world.get(shade, Vitality);
  assert(vit.hp > 20, 'carrion shade should have overhealth');
});

// ── Guard tests ──────────────────────────────────────────────────────────────

Deno.test("cooldown: monster does not eat twice within cooldown", () => {
  const world = makeWorld(7);
  const rat = placeMonster(world, 8, 5, 'rat', { hp: 2, maxHp: 5 });
  const corpse1 = placeCorpse(world, 8, 5, 200);

  aiCorpseEatSystem(world);
  assert(!world.isAlive(corpse1), 'first corpse eaten');

  // Place another corpse, advance 1 tick (still within cooldown of 5)
  world.step = 1;
  world.get(rat, Vitality).hp = 2; // reset hp
  const corpse2 = placeCorpse(world, 8, 5, 200);

  aiCorpseEatSystem(world);
  assert(world.isAlive(corpse2), 'second corpse should remain — still on cooldown');
});

Deno.test("skip when MoveIntent already queued", () => {
  const world = makeWorld(8);
  const rat = placeMonster(world, 8, 5, 'rat', { hp: 2, maxHp: 5 });
  world.add(rat, MoveIntent, { dx: 1, dy: 0 });
  const corpse = placeCorpse(world, 8, 5, 200);

  aiCorpseEatSystem(world);

  assert(world.isAlive(corpse), 'corpse should remain — rat already has MoveIntent');
});

Deno.test("hunting low-intel monster (rat, intel 2) does NOT eat", () => {
  const world = makeWorld(9);
  placeMonster(world, 8, 5, 'rat', { alertLevel: AGGRO_LEVELS.hunting, hp: 2, maxHp: 5 });
  const corpse = placeCorpse(world, 8, 5, 200);

  aiCorpseEatSystem(world);

  assert(world.isAlive(corpse), 'corpse should remain — dumb hunting rat ignores it');
});

Deno.test("hunting smart monster (carrion shade, intel 7) eats when far from player", () => {
  const world = makeWorld(10);
  // Shade at (12,5), player at (5,5) → Chebyshev 7, far enough
  const shade = placeMonster(world, 12, 5, 'carrion_shade', {
    alertLevel: AGGRO_LEVELS.hunting, hp: 20, maxHp: 20,
  });
  const corpse = placeCorpse(world, 12, 5, 200);

  aiCorpseEatSystem(world);

  assert(!world.isAlive(corpse), 'shade should eat — smart and far from player');
});

Deno.test("hunting smart monster does NOT eat when adjacent to player", () => {
  const world = makeWorld(11);
  // Shade at (6,5), player at (5,5) → Chebyshev 1, adjacent
  placeMonster(world, 6, 5, 'carrion_shade', {
    alertLevel: AGGRO_LEVELS.hunting, hp: 20, maxHp: 20,
  });
  const corpse = placeCorpse(world, 6, 5, 200);

  aiCorpseEatSystem(world);

  assert(world.isAlive(corpse), 'corpse should remain — shade adjacent to player');
});

Deno.test("pet corpses are not consumed", () => {
  const world = makeWorld(12);
  placeMonster(world, 8, 5, 'rat', { hp: 2, maxHp: 5 });
  const corpse = placeCorpse(world, 8, 5, 200);
  world.add(corpse, Pet); // mark as pet corpse

  aiCorpseEatSystem(world);

  assert(world.isAlive(corpse), 'pet corpse should not be eaten');
});

Deno.test("monster:corpse-eat event emitted with correct payload", () => {
  const world = makeWorld(13);
  placeMonster(world, 8, 5, 'troll', { hp: 25, maxHp: 25 });
  placeCorpse(world, 8, 5, 200);

  const events = [];
  world.on('monster:corpse-eat', (ev) => events.push(ev));

  aiCorpseEatSystem(world);

  assertEquals(events.length, 1, 'exactly one event');
  assertEquals(events[0].behavior, 'devour');
  assertEquals(events[0].monsterName, 'Troll');
  assert(events[0].healAmount > 0, 'should report heal amount');
});

Deno.test("two monsters cannot eat the same corpse in one tick", () => {
  const world = makeWorld(14);
  placeMonster(world, 8, 5, 'rat', { hp: 2, maxHp: 5 });
  placeMonster(world, 8, 6, 'rat', { hp: 2, maxHp: 5 });
  const corpse = placeCorpse(world, 8, 5, 200); // adjacent to both

  const events = [];
  world.on('monster:corpse-eat', (ev) => events.push(ev));

  aiCorpseEatSystem(world);

  assertEquals(events.length, 1, 'only one monster should eat the corpse');
});

Deno.test("monster without corpseEat config ignores corpses", () => {
  const world = makeWorld(15);
  // bat has no corpseEat config
  placeMonster(world, 8, 5, 'bat', { hp: 1, maxHp: 3 });
  const corpse = placeCorpse(world, 8, 5, 200);

  aiCorpseEatSystem(world);

  assert(world.isAlive(corpse), 'corpse should remain — bat has no corpseEat');
});
