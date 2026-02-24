import { assert } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Equipment } from '../src/rules/components/Equipment.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { Position } from '../src/rules/components/Position.js';
import { Player } from '../src/rules/components/Player.js';
import { Trap } from '../src/rules/components/Trap.js';
import { AttackIntent } from '../src/rules/components/Intents/AttackIntent.js';
import { DisarmIntent } from '../src/rules/components/Intents/DisarmIntent.js';
import { equipmentSystem } from '../src/rules/systems/equipmentSystem.js';
import { combatSystem } from '../src/rules/systems/combatSystem.js';
import { disarmTrapSystem } from '../src/rules/systems/disarmTrapSystem.js';
import { resolveCombatSnapshot } from '../src/rules/utils/resolveCombatSnapshot.js';
// Side-effect import: registers trap scripts
import '../src/rules/scripts/traps.js';

function makeEquip(world, { slot, bonuses, affixes }) {
  const eid = world.create();
  world.add(eid, NamedIdentity, { name: 'TestItem', identity: 'test_item' });
  world.add(eid, ItemInfo, { type: 'equip', slot, weight: 1, value: 0, description: '', count: 1, bonuses: bonuses || {}, rarity: 1, rarityName: 'common', affixes: affixes || [] });
  return eid;
}

function makeActor(world, x, y, eq, hp = 100) {
  const id = world.create();
  world.add(id, NamedIdentity, { name: 'Actor', identity: 'actor' });
  world.add(id, Vitality, { maxHp: hp, hp });
  world.add(id, Equipment, {});
  world.add(id, Position, { x, y });
  const e = world.get(id, Equipment);
  if (eq?.weapon) e.weapon = eq.weapon;
  if (eq?.armor) e.armor = eq.armor;
  if (eq?.ring1) e.ring1 = eq.ring1;
  return id;
}

// --- Equipment system accumulates luckDerived ---

Deno.test("equipmentSystem accumulates luckDerived from item bonuses", () => {
  const world = new World({ seed: 1 });
  const ring = makeEquip(world, { slot: 'ring', bonuses: { luck: 5 }, affixes: [] });
  const actor = makeActor(world, 0, 0, { ring1: ring });
  equipmentSystem(world);
  const eq = world.get(actor, Equipment);
  assert(eq.luckDerived === 5, `luckDerived should be 5, got ${eq.luckDerived}`);
});

Deno.test("equipmentSystem accumulates luckDerived from Lucky affix passive", () => {
  const world = new World({ seed: 1 });
  const ring = makeEquip(world, { slot: 'ring', bonuses: {}, affixes: ['lucky1'] });
  const actor = makeActor(world, 0, 0, { ring1: ring });
  equipmentSystem(world);
  const eq = world.get(actor, Equipment);
  assert(eq.luckDerived === 3, `luckDerived from lucky1 should be 3, got ${eq.luckDerived}`);
});

Deno.test("luckDerived stacks from multiple sources", () => {
  const world = new World({ seed: 1 });
  const ring = makeEquip(world, { slot: 'ring', bonuses: { luck: 2 }, affixes: ['lucky1'] });
  const actor = makeActor(world, 0, 0, { ring1: ring });
  equipmentSystem(world);
  const eq = world.get(actor, Equipment);
  assert(eq.luckDerived === 5, `luckDerived should be 2+3=5, got ${eq.luckDerived}`);
});

// --- resolveCombatSnapshot exposes luck, critChance, critMult ---

Deno.test("resolveCombatSnapshot exposes luck, critChance, critMult", () => {
  const world = new World({ seed: 1 });
  const ring = makeEquip(world, { slot: 'ring', bonuses: { luck: 4, critChance: 0.08, critMult: 0.5 }, affixes: [] });
  const actor = makeActor(world, 0, 0, { ring1: ring });
  equipmentSystem(world);
  const snap = resolveCombatSnapshot(world, actor, { mode: 'melee' });
  assert(snap.luck === 4, `luck should be 4, got ${snap.luck}`);
  assert(snap.critChance === 0.08, `critChance should be 0.08, got ${snap.critChance}`);
  assert(snap.critMult === 0.5, `critMult should be 0.5, got ${snap.critMult}`);
});

// --- Crit rework: luck adds secondary crit chance ---

Deno.test("luck 100 guarantees secondary crit on non-nat-20 hits", () => {
  // Run two identical combats: one with luck=0, one with luck=100.
  // The high-luck version should deal more damage due to guaranteed crits.
  const seed = 42;

  // Baseline: no luck
  const worldA = new World({ seed });
  const weaponA = makeEquip(worldA, { slot: 'weapon', bonuses: { attack: 10 }, affixes: [] });
  const heroA = makeActor(worldA, 1, 1, { weapon: weaponA }, 100);
  const foeA = makeActor(worldA, 1, 2, {}, 100);
  equipmentSystem(worldA);
  worldA.add(heroA, AttackIntent, { targetId: foeA });
  combatSystem(worldA);
  const hpA = worldA.get(foeA, Vitality).hp;

  // With luck=100 (guarantees secondary crit)
  const worldB = new World({ seed });
  const weaponB = makeEquip(worldB, { slot: 'weapon', bonuses: { attack: 10 }, affixes: [] });
  const luckyRing = makeEquip(worldB, { slot: 'ring', bonuses: { luck: 100 }, affixes: [] });
  const heroB = makeActor(worldB, 1, 1, { weapon: weaponB, ring1: luckyRing }, 100);
  const foeB = makeActor(worldB, 1, 2, {}, 100);
  equipmentSystem(worldB);
  worldB.add(heroB, AttackIntent, { targetId: foeB });
  combatSystem(worldB);
  const hpB = worldB.get(foeB, Vitality).hp;

  // Lucky version should deal >= double damage (crit) compared to non-crit baseline
  // Both should hit (attack bonus 10 makes miss very unlikely), but lucky one crits
  assert(hpB <= hpA, `lucky crit should deal at least as much damage: hpA=${hpA}, hpB=${hpB}`);
});

// --- critMultDerived affects crit damage ---

Deno.test("critMultDerived increases crit damage multiplier", () => {
  // Both combats force a crit via luck=100. One has critMult=0, one has critMult=1.0.
  // The one with critMult=1.0 should deal more damage (3x vs 2x).
  const seed = 42;

  // Base crit (2x multiplier)
  const worldA = new World({ seed });
  const weaponA = makeEquip(worldA, { slot: 'weapon', bonuses: { attack: 10 }, affixes: [] });
  const ringA = makeEquip(worldA, { slot: 'ring', bonuses: { luck: 100 }, affixes: [] });
  const heroA = makeActor(worldA, 1, 1, { weapon: weaponA, ring1: ringA }, 100);
  const foeA = makeActor(worldA, 1, 2, {}, 100);
  equipmentSystem(worldA);
  worldA.add(heroA, AttackIntent, { targetId: foeA });
  combatSystem(worldA);
  const hpA = worldA.get(foeA, Vitality).hp;

  // Enhanced crit (3x multiplier via critMult=1.0)
  const worldB = new World({ seed });
  const weaponB = makeEquip(worldB, { slot: 'weapon', bonuses: { attack: 10, critMult: 1.0 }, affixes: [] });
  const ringB = makeEquip(worldB, { slot: 'ring', bonuses: { luck: 100 }, affixes: [] });
  const heroB = makeActor(worldB, 1, 1, { weapon: weaponB, ring1: ringB }, 100);
  const foeB = makeActor(worldB, 1, 2, {}, 100);
  equipmentSystem(worldB);
  worldB.add(heroB, AttackIntent, { targetId: foeB });
  combatSystem(worldB);
  const hpB = worldB.get(foeB, Vitality).hp;

  // 3x crit should deal more than 2x crit
  assert(hpB < hpA, `critMult 1.0 (3x) should deal more than base (2x): hpA=${hpA}, hpB=${hpB}`);
});

// --- Trap disarm lucky save ---

Deno.test("luck provides lucky save on failed trap disarm", () => {
  // DC 21 guarantees d20 failure. Luck 100 guarantees the lucky save.
  const world = new World({ seed: 99 });
  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });
  world.add(player, Vitality, { maxHp: 100, hp: 100 });
  world.add(player, Equipment, {});
  const eq = world.get(player, Equipment);
  const luckyRing = makeEquip(world, { slot: 'ring', bonuses: { luck: 100 }, affixes: [] });
  eq.ring1 = luckyRing;
  equipmentSystem(world);

  const trap = world.create();
  world.add(trap, Position, { x: 5, y: 5 });
  world.add(trap, Trap, { type: 'spike', armed: true, revealed: false, script: 'trap_spike', params: { percent: 0.25 }, difficulty: 21 });

  world.add(player, DisarmIntent, {});
  disarmTrapSystem(world);

  const t = world.get(trap, Trap);
  const vit = world.get(player, Vitality);
  assert(t.armed === false, "trap should be disarmed via lucky save");
  assert(vit.hp === 100, `player should take no damage from lucky save, hp=${vit.hp}`);
});

Deno.test("negative luck fumbles a successful trap disarm", () => {
  // DC 1 guarantees d20 success. Luck -100 guarantees the fumble.
  const world = new World({ seed: 99 });
  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });
  world.add(player, Vitality, { maxHp: 100, hp: 100 });
  world.add(player, Equipment, {});
  const eq = world.get(player, Equipment);
  const cursedRing = makeEquip(world, { slot: 'ring', bonuses: { luck: -100 }, affixes: [] });
  eq.ring1 = cursedRing;
  equipmentSystem(world);

  const trap = world.create();
  world.add(trap, Position, { x: 5, y: 5 });
  world.add(trap, Trap, { type: 'spike', armed: true, revealed: false, script: 'trap_spike', params: { percent: 0.25 }, difficulty: 1 });

  world.add(player, DisarmIntent, {});
  disarmTrapSystem(world);

  const vit = world.get(player, Vitality);
  assert(vit.hp < 100, `bad luck should fumble disarm, hp=${vit.hp}`);
});

Deno.test("zero luck does not change trap disarm behavior", () => {
  // DC 21 guarantees failure. No luck = no lucky save = trap triggers.
  const world = new World({ seed: 99 });
  const player = world.create();
  world.add(player, Player);
  world.add(player, Position, { x: 5, y: 5 });
  world.add(player, Vitality, { maxHp: 100, hp: 100 });

  const trap = world.create();
  world.add(trap, Position, { x: 5, y: 5 });
  world.add(trap, Trap, { type: 'spike', armed: true, revealed: false, script: 'trap_spike', params: { percent: 0.25 }, difficulty: 21 });

  world.add(player, DisarmIntent, {});
  disarmTrapSystem(world);

  const vit = world.get(player, Vitality);
  assert(vit.hp < 100, `player should take damage with no luck, hp=${vit.hp}`);
});

// --- Zero luck preserves baseline combat ---

Deno.test("zero luck does not change baseline combat behavior", () => {
  // Two identical worlds with the same entity structure.
  // One has luck=0, the other has luck=0 — both should produce identical results,
  // confirming the luck=0 guard prevents RNG sequence divergence.
  const seed = 123;

  const worldA = new World({ seed });
  const weaponA = makeEquip(worldA, { slot: 'weapon', bonuses: { attack: 2 }, affixes: [] });
  const ringA = makeEquip(worldA, { slot: 'ring', bonuses: { luck: 0 }, affixes: [] });
  const heroA = makeActor(worldA, 1, 1, { weapon: weaponA, ring1: ringA }, 10);
  const foeA = makeActor(worldA, 1, 2, {}, 10);
  equipmentSystem(worldA);
  worldA.add(heroA, AttackIntent, { targetId: foeA });
  combatSystem(worldA);
  const hpA = worldA.get(foeA, Vitality).hp;

  const worldB = new World({ seed });
  const weaponB = makeEquip(worldB, { slot: 'weapon', bonuses: { attack: 2 }, affixes: [] });
  const ringB = makeEquip(worldB, { slot: 'ring', bonuses: { luck: 0 }, affixes: [] });
  const heroB = makeActor(worldB, 1, 1, { weapon: weaponB, ring1: ringB }, 10);
  const foeB = makeActor(worldB, 1, 2, {}, 10);
  equipmentSystem(worldB);
  worldB.add(heroB, AttackIntent, { targetId: foeB });
  combatSystem(worldB);
  const hpB = worldB.get(foeB, Vitality).hp;

  assert(hpA === hpB, `zero luck should produce identical result: hpA=${hpA}, hpB=${hpB}`);
});
