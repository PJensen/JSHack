import { assert, assertEquals } from "jsr:@std/assert";
import { CLASS_DEFS, getClass, listClassIds } from '../src/rules/data/classes.js';
import { DEITY_DEFS } from '../src/rules/data/deities.js';
import { getCatalogItem } from '../src/rules/data/itemCatalog.js';
import { getSpell } from "../src/rules/data/spells.js";

Deno.test("CLASS_DEFS has exactly 6 classes", () => {
  const ids = listClassIds();
  assertEquals(ids.length, 6);
  for (const id of ['druid', 'warden', 'outlaw', 'cleric', 'archeologist', 'warlock']) {
    assert(ids.includes(id), `missing class: ${id}`);
  }
});

Deno.test("each class has a valid deityId", () => {
  for (const [id, def] of Object.entries(CLASS_DEFS)) {
    assert(DEITY_DEFS[def.deityId] != null,
      `class ${id} references unknown deity: ${def.deityId}`);
  }
});

Deno.test("each class has positive maxHp and maxMana", () => {
  for (const [id, def] of Object.entries(CLASS_DEFS)) {
    assert(def.stats.maxHp > 0, `class ${id} has non-positive maxHp`);
    assert(def.stats.maxMana > 0, `class ${id} has non-positive maxMana`);
  }
});

Deno.test("getClass returns null for unknown id", () => {
  assertEquals(getClass('wizard'), null);
});

Deno.test("druid maps to gaia", () => {
  assertEquals(getClass('druid').deityId, 'gaia');
});

Deno.test("warden maps to molkhar", () => {
  assertEquals(getClass('warden').deityId, 'molkhar');
});

Deno.test("outlaw maps to loki", () => {
  assertEquals(getClass('outlaw').deityId, 'loki');
});

Deno.test("cleric maps to seraphine", () => {
  assertEquals(getClass('cleric').deityId, 'seraphine');
});

Deno.test("cleric starts with one vial of holy water", () => {
  const cleric = getClass('cleric');
  const holyWater = cleric.inventoryItems.find((entry) => entry.itemId === 'potion_holy_water');
  assert(holyWater, 'cleric should include potion_holy_water in starter inventory');
  assertEquals(holyWater.count, 1);
});

Deno.test("cleric starts with flash_heal as their class spell", () => {
  const cleric = getClass("cleric");
  assertEquals(cleric.startingSpell, "flash_heal");
  assert(getSpell("flash_heal"), "flash_heal spell definition should exist");
});

Deno.test("warden has highest maxHp", () => {
  const hps = Object.values(CLASS_DEFS).map(c => c.stats.maxHp);
  const warden = getClass('warden').stats.maxHp;
  assert(hps.every(hp => hp <= warden), 'warden should have highest maxHp');
});

Deno.test("equipment and inventory items have valid string ids", () => {
  for (const [classId, def] of Object.entries(CLASS_DEFS)) {
    for (const [slot, itemId] of Object.entries(def.equipment)) {
      if (itemId !== null) {
        assert(typeof itemId === 'string' && itemId.length > 0,
          `class ${classId} equipment.${slot} has invalid itemId`);
      }
    }
    for (const entry of def.inventoryItems) {
      assert(typeof entry.itemId === 'string' && entry.itemId.length > 0,
        `class ${classId} has invalid inventory itemId`);
      assert(typeof entry.count === 'number' && entry.count > 0,
        `class ${classId} inventory item ${entry.itemId} has invalid count`);
    }
  }
});

Deno.test("each class has a valid deity", () => {
  for (const [id, def] of Object.entries(CLASS_DEFS)) {
    assert(DEITY_DEFS[def.deityId] != null,
      `class ${id} references unknown deity: ${def.deityId}`);
  }
});

Deno.test("warlock maps to molkhar", () => {
  assertEquals(getClass('warlock').deityId, 'molkhar');
});

Deno.test("warlock starts with summon_skeleton and shadow_bolt", () => {
  const warlock = getClass('warlock');
  assert(Array.isArray(warlock.startingSpells), 'warlock should have startingSpells array');
  assert(warlock.startingSpells.includes('summon_skeleton'), 'warlock should start with summon_skeleton');
  assert(warlock.startingSpells.includes('shadow_bolt'), 'warlock should start with shadow_bolt');
  assert(getSpell("summon_skeleton"), "summon_skeleton spell definition should exist");
  assert(getSpell("shadow_bolt"), "shadow_bolt spell definition should exist");
});

Deno.test("shadow_bolt has 2-turn cast time and deals damage", () => {
  const spell = getSpell("shadow_bolt");
  assert(spell, "shadow_bolt should exist");
  assertEquals(spell.castTime, 2);
  assert(spell.manaCost > 0, "shadow_bolt should cost mana");
  const dmgEffect = spell.effects.find(e => e.kind === 'damage');
  assert(dmgEffect, "shadow_bolt should have a damage effect");
  const amountText = String(dmgEffect.amount ?? "");
  assert(/[1-9]/.test(amountText), "shadow_bolt damage should describe a positive amount");
});

Deno.test("summon_skeleton has 5-turn cast time", () => {
  const spell = getSpell("summon_skeleton");
  assert(spell, "summon_skeleton should exist");
  assertEquals(spell.castTime, 5);
});

Deno.test("druid starts with at least +1 defense from equipped gear", () => {
  const druid = getClass('druid');
  const equippedIds = Object.values(druid.equipment).filter((id) => typeof id === 'string');
  const defenseTotal = equippedIds.reduce((sum, itemId) => {
    const def = getCatalogItem(itemId);
    const bonus = Number(def?.bonuses?.defense || 0);
    return sum + bonus;
  }, 0);
  assert(defenseTotal >= 1, `druid defense from starter gear should be >= 1, got ${defenseTotal}`);
});
