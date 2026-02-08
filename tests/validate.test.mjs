import { assert } from "jsr:@std/assert";
import { EQUIP_DEFS } from '../src/rules/data/equipment.js';
import { AFFIX_DEFS } from '../src/rules/data/affixes.js';
import { validateAll } from '../src/rules/data/validate.js';

Deno.test("data validation passes for equipment and affixes", () => {
  const ok = validateAll({ EQUIP_DEFS, AFFIX_DEFS });
  assert(ok === true, 'validation returns true');
});
