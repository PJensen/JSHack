import { MATERIAL_CATALOG } from '../src/rules/data/materials.js';
import { SPELL_DEFS, getSpell, listSpells } from '../src/rules/data/spells.js';
import { ITEM_DEFS, getItem, listItems } from '../src/rules/data/items.js';
import { AFFIX_DEFS, getAffix, listAffixes } from '../src/rules/data/affixes.js';
import { registerScript, runScript, listRegisteredScripts, ScriptVerb } from '../src/rules/scripting.js';

function assert(c, m) { if (!c) throw new Error('Assertion failed: ' + m); }

const MATERIAL_FIELDS = [
  'kind', 'mohsHardness', 'density_g_cm3', 'brittleness',
  'flammability', 'ignitionTempC', 'burnSeverity', 'meltPointC',
  'wetAbsorbency', 'conductivity', 'corrosionResist',
  'lightPass', 'lightReflect', 'lightAbsorb', 'lightEmit',
  'radShieldAlpha', 'radShieldBeta', 'radShieldGamma', 'radShieldNeutron', 'radActivation'
];

async function run() {
  // --- Materials ---
  assert(Array.isArray(MATERIAL_CATALOG), 'MATERIAL_CATALOG should be an array');
  assert(MATERIAL_CATALOG.length > 0, 'MATERIAL_CATALOG should not be empty');

  const matIds = new Set();
  for (const entry of MATERIAL_CATALOG) {
    assert(typeof entry.id === 'string' && entry.id.length > 0, `material must have string id`);
    assert(!matIds.has(entry.id), `duplicate material id: ${entry.id}`);
    matIds.add(entry.id);

    const mat = entry.Material;
    assert(mat && typeof mat === 'object', `material ${entry.id} must have Material object`);

    for (const field of MATERIAL_FIELDS) {
      const val = mat[field];
      if (field === 'kind') {
        assert(typeof val === 'string', `${entry.id}.kind must be string`);
      } else {
        assert(typeof val === 'number', `${entry.id}.${field} must be number, got ${typeof val}`);
      }
    }

    // Physical sanity: density > 0, hardness >= 0
    assert(mat.density_g_cm3 > 0, `${entry.id} density must be positive`);
    assert(mat.mohsHardness >= 0, `${entry.id} hardness must be non-negative`);
  }

  // --- Spells ---
  assert(Object.keys(SPELL_DEFS).length > 0, 'SPELL_DEFS should not be empty');

  for (const [id, spell] of Object.entries(SPELL_DEFS)) {
    assert(spell.id === id, `spell key ${id} should match spell.id ${spell.id}`);
    assert(typeof spell.name === 'string' && spell.name.length > 0, `spell ${id} must have name`);
    assert(typeof spell.manaCost === 'number' && spell.manaCost > 0, `spell ${id} must have positive manaCost`);
  }

  assert(getSpell('lightning') !== null, 'getSpell should find lightning');
  assert(getSpell('nonexistent') === null, 'getSpell should return null for missing');
  assert(listSpells().length === Object.keys(SPELL_DEFS).length, 'listSpells length should match');

  // --- Items ---
  assert(Object.keys(ITEM_DEFS).length > 0, 'ITEM_DEFS should not be empty');

  for (const [id, item] of Object.entries(ITEM_DEFS)) {
    assert(item.id === id, `item key ${id} should match item.id`);
    assert(typeof item.name === 'string' && item.name.length > 0, `item ${id} must have name`);
    assert(typeof item.type === 'string', `item ${id} must have type`);
  }

  assert(getItem('book_lightning') !== null, 'getItem should find book_lightning');
  assert(getItem('nonexistent') === null, 'getItem should return null for missing');
  assert(listItems().length === Object.keys(ITEM_DEFS).length, 'listItems length should match');

  // --- Affixes ---
  assert(Object.keys(AFFIX_DEFS).length > 0, 'AFFIX_DEFS should not be empty');

  for (const [id, affix] of Object.entries(AFFIX_DEFS)) {
    // Skip test affixes that might be registered by other tests
    if (id.startsWith('test_')) continue;
    assert(typeof affix.name === 'string', `affix ${id} must have name`);
    assert(Array.isArray(affix.slots), `affix ${id} must have slots array`);
    assert(Array.isArray(affix.triggers), `affix ${id} must have triggers array`);
    assert(typeof affix.weight === 'number', `affix ${id} must have numeric weight`);
  }

  assert(getAffix('fierce') !== null, 'getAffix should find fierce');
  assert(getAffix('nonexistent') === null, 'getAffix should return null for missing');
  assert(listAffixes().length >= Object.keys(AFFIX_DEFS).length, 'listAffixes should return all');

  // --- Scripting registry ---
  // Register and run a test script
  let called = false;
  registerScript('test:data_integrity', {
    ['test:verb']: (_world, ctx) => { called = true; ctx.result = 42; }
  });

  const ctx = {};
  runScript('test:data_integrity', 'test:verb', null, ctx);
  assert(called, 'registered script should be callable');
  assert(ctx.result === 42, 'script should mutate context');

  // runScript with missing key should not throw
  runScript('nonexistent:key', 'test:verb', null, {});

  // listRegisteredScripts should include our test script
  const scripts = listRegisteredScripts();
  assert(scripts.includes('test:data_integrity'), 'registered script should appear in list');

  console.log(`Data integrity tests PASS (${MATERIAL_CATALOG.length} materials, ${Object.keys(SPELL_DEFS).length} spells, ${Object.keys(ITEM_DEFS).length} items, ${Object.keys(AFFIX_DEFS).length} affixes)`);
}

run().catch(e => { console.error(e); process.exitCode = 1; });
