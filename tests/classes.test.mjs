import { assert, assertEquals } from "jsr:@std/assert";
import { CLASS_DEFS, getClass, listClassIds } from '../src/rules/data/classes.js';
import { DEITY_DEFS } from '../src/rules/data/deities.js';

Deno.test("CLASS_DEFS has exactly 4 classes", () => {
  const ids = listClassIds();
  assertEquals(ids.length, 4);
  for (const id of ['druid', 'warden', 'outlaw', 'cleric']) {
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

Deno.test("each class has a unique deity", () => {
  const deities = Object.values(CLASS_DEFS).map(c => c.deityId);
  assertEquals(new Set(deities).size, deities.length, 'duplicate deity assignments');
});
