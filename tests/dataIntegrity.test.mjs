import { assert } from "jsr:@std/assert";
import { SPELL_DEFS, getSpell, listSpells } from '../src/rules/data/spells.js';
import { ITEM_DEFS, getItem, listItems } from '../src/rules/data/items.js';
import { AFFIX_DEFS, getAffix, listAffixes } from '../src/rules/data/affixes.js';
import { registerScript, runScript, listRegisteredScripts, ScriptVerb } from '../src/rules/scripting.js';

Deno.test("spell definitions are valid", () => {
  assert(Object.keys(SPELL_DEFS).length > 0, 'SPELL_DEFS should not be empty');

  for (const [id, spell] of Object.entries(SPELL_DEFS)) {
    assert(spell.id === id, `spell key ${id} should match spell.id ${spell.id}`);
    assert(typeof spell.name === 'string' && spell.name.length > 0, `spell ${id} must have name`);
    assert(typeof spell.manaCost === 'number' && spell.manaCost > 0, `spell ${id} must have positive manaCost`);
  }

  assert(getSpell('lightning') !== null, 'getSpell should find lightning');
  assert(getSpell('nonexistent') === null, 'getSpell should return null for missing');
  assert(listSpells().length === Object.keys(SPELL_DEFS).length, 'listSpells length should match');
});

Deno.test("item definitions are valid", () => {
  assert(Object.keys(ITEM_DEFS).length > 0, 'ITEM_DEFS should not be empty');

  for (const [id, item] of Object.entries(ITEM_DEFS)) {
    assert(item.id === id, `item key ${id} should match item.id`);
    assert(typeof item.name === 'string' && item.name.length > 0, `item ${id} must have name`);
    assert(typeof item.type === 'string', `item ${id} must have type`);
  }

  assert(getItem('book_lightning') !== null, 'getItem should find book_lightning');
  assert(getItem('nonexistent') === null, 'getItem should return null for missing');
  assert(listItems().length === Object.keys(ITEM_DEFS).length, 'listItems length should match');
});

Deno.test("affix definitions are valid", () => {
  assert(Object.keys(AFFIX_DEFS).length > 0, 'AFFIX_DEFS should not be empty');

  for (const [id, affix] of Object.entries(AFFIX_DEFS)) {
    if (id.startsWith('test_')) continue;
    assert(typeof affix.name === 'string', `affix ${id} must have name`);
    assert(Array.isArray(affix.slots), `affix ${id} must have slots array`);
    assert(Array.isArray(affix.triggers), `affix ${id} must have triggers array`);
    assert(typeof affix.weight === 'number', `affix ${id} must have numeric weight`);
  }

  assert(getAffix('fierce') !== null, 'getAffix should find fierce');
  assert(getAffix('nonexistent') === null, 'getAffix should return null for missing');
  assert(listAffixes().length >= Object.keys(AFFIX_DEFS).length, 'listAffixes should return all');
});

Deno.test("scripting registry works", () => {
  let called = false;
  registerScript('test:data_integrity', {
    ['test:verb']: (_world, ctx) => { called = true; ctx.result = 42; }
  });

  const ctx = {};
  runScript('test:data_integrity', 'test:verb', null, ctx);
  assert(called, 'registered script should be callable');
  assert(ctx.result === 42, 'script should mutate context');

  runScript('nonexistent:key', 'test:verb', null, {});

  const scripts = listRegisteredScripts();
  assert(scripts.includes('test:data_integrity'), 'registered script should appear in list');
});
