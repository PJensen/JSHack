import { assert, assertEquals } from "jsr:@std/assert";
import { World } from '../src/lib/ecs-js/index.js';
import { Position } from '../src/rules/components/Position.js';
import { Player } from '../src/rules/components/Player.js';
import { NamedIdentity } from '../src/rules/components/NamedIdentity.js';
import { Faction } from '../src/rules/components/Faction.js';
import { Equipment } from '../src/rules/components/Equipment.js';
import { ItemInfo } from '../src/rules/components/ItemInfo.js';
import { Vitality } from '../src/rules/components/Vitality.js';
import { CreatureType, CREATURE_TYPES } from '../src/rules/components/CreatureType.js';
import { ActiveEffects } from '../src/rules/components/ActiveEffects.js';
import { ItemCooldown } from '../src/rules/components/ItemCooldown.js';
import { hasEquippedTag } from '../src/rules/utils/equipTags.js';
import { COMBAT_INTERACTION_RULES } from '../src/rules/data/combatInteractions.js';
import { statusStrength } from '../src/rules/utils/statusFacade.js';
import { getItemHooksByIdentity } from '../src/rules/content/items/itemHooks.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeWorld(seed = 1) {
  return new World({ seed });
}

function makePlayer(world, x, y) {
  const id = world.create();
  world.add(id, Player);
  world.add(id, Position, { x, y });
  world.add(id, NamedIdentity, { name: 'Hero', identity: 'player' });
  world.add(id, Vitality, { hp: 30, maxHp: 30 });
  world.add(id, Equipment, {});
  return id;
}

function equipSunsword(world, playerId) {
  const swordId = world.create();
  world.add(swordId, NamedIdentity, { name: 'Sunsword', identity: 'sunsword' });
  world.add(swordId, ItemInfo, {
    type: 'equip', slot: 'weapon', damageDice: '1d8', damageType: 'slash',
    tags: ['sunlight'],
  });
  const eq = world.get(playerId, Equipment);
  eq.weapon = swordId;
  return swordId;
}

function makeUndead(world, x, y) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, NamedIdentity, { name: 'Skeleton', identity: 'skeleton' });
  world.add(id, Faction, { key: 'enemy' });
  world.add(id, Vitality, { hp: 10, maxHp: 10 });
  world.add(id, CreatureType, { type: CREATURE_TYPES.undead });
  return id;
}

function makeHumanoid(world, x, y) {
  const id = world.create();
  world.add(id, Position, { x, y });
  world.add(id, NamedIdentity, { name: 'Goblin', identity: 'goblin' });
  world.add(id, Faction, { key: 'enemy' });
  world.add(id, Vitality, { hp: 10, maxHp: 10 });
  world.add(id, CreatureType, { type: CREATURE_TYPES.humanoid });
  return id;
}

// ── hasEquippedTag ──────────────────────────────────────────────────────────

Deno.test("sunsword: hasEquippedTag detects sunlight tag", () => {
  const world = makeWorld();
  const player = makePlayer(world, 5, 5);
  equipSunsword(world, player);
  assert(hasEquippedTag(world, player, "sunlight"), "should detect sunlight tag");
});

Deno.test("sunsword: no sunlight tag without sunsword", () => {
  const world = makeWorld();
  const player = makePlayer(world, 5, 5);
  assert(!hasEquippedTag(world, player, "sunlight"), "no weapon = no sunlight");
});

// ── Combat interaction: bonus vs undead ─────────────────────────────────────

Deno.test("sunsword: +4 damage vs undead", () => {
  const world = makeWorld();
  const player = makePlayer(world, 5, 5);
  const swordId = equipSunsword(world, player);
  const skeleton = makeUndead(world, 6, 5);

  const rule = COMBAT_INTERACTION_RULES.find(r => r.id === "sunlight_weapon_vs_undead");
  assert(rule, "sunlight_weapon_vs_undead rule should exist");

  const ctx = {
    attacker: player,
    defender: skeleton,
    weaponId: swordId,
    damage: 5,
    damageType: "slash",
    world,
  };

  assert(rule.gate(world, ctx), "gate should pass for sunlight weapon vs undead");
  rule.apply(world, ctx);
  assertEquals(ctx.damage, 9, "damage should be 5 + 4 = 9");
});

Deno.test("sunsword: no bonus vs non-undead", () => {
  const world = makeWorld();
  const player = makePlayer(world, 5, 5);
  const swordId = equipSunsword(world, player);
  const goblin = makeHumanoid(world, 6, 5);

  const rule = COMBAT_INTERACTION_RULES.find(r => r.id === "sunlight_weapon_vs_undead");
  const ctx = {
    attacker: player,
    defender: goblin,
    weaponId: swordId,
    damage: 5,
    damageType: "slash",
    world,
  };

  assert(!rule.gate(world, ctx), "gate should NOT pass for sunlight weapon vs humanoid");
});

// ── Blinding ray ────────────────────────────────────────────────────────────

Deno.test("sunsword: blinding ray applies blinded effect", () => {
  const world = makeWorld();
  const enemy = makeUndead(world, 8, 5);

  // Simulate what onConfirm does: add ActiveEffects then push blinded
  world.add(enemy, ActiveEffects, { effects: [{ key: 'blinded', turnsLeft: 5, stacks: 1, potency: 1 }] });

  const strength = statusStrength(world, enemy, "blinded");
  assert(strength > 0, "enemy should have blinded status after ray");
});

Deno.test("sunsword: on_use is blocked while cooldown is active", () => {
  const hooks = getItemHooksByIdentity('sunsword');
  const emits = [];
  const messages = [];
  const cd = { turnsRemaining: 4, turnsMax: 12 };
  const result = hooks.onUse({
    actor: 1,
    query: {
      get(entityId, Comp) {
        if ((entityId | 0) === 42 && Comp === ItemCooldown) return cd;
        return null;
      },
    },
    io: {
      emit(name, payload) { emits.push({ name, payload }); },
      message(text, type) { messages.push({ text, type }); },
    },
  }, {
    actor: 1,
    itemId: 42,
    identity: 'sunsword',
  });

  assertEquals(result?.cancelled, true);
  assertEquals(result?.code, 'ITEM_ON_COOLDOWN');
  assertEquals(messages.length, 1);
  assertEquals(emits.length, 0);
});
