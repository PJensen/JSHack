import { assert } from "jsr:@std/assert";
import { ITEM_CATALOG } from '../src/rules/data/itemCatalog.js';
import { AFFIX_DEFS } from '../src/rules/data/affixes.js';
import { EFFECT_DEFS, EFFECT_OPERATION_IDS } from '../src/rules/data/effectDefs.js';
import { ITEM_USE_ACTION_IDS, ITEM_USE_DEFS } from '../src/rules/data/itemUseDefs.js';
import { MATERIAL_REACTION_OUTCOME_IDS, MATERIAL_REACTION_RULES } from '../src/rules/data/materialReactions.js';
import { validateAll } from '../src/rules/data/validate.js';

Deno.test("data validation passes for item catalog, affixes, effects, item-use, and material reactions", () => {
  const ok = validateAll({
    ITEM_CATALOG,
    AFFIX_DEFS,
    EFFECT_DEFS,
    EFFECT_OPERATION_IDS,
    ITEM_USE_DEFS,
    ITEM_USE_ACTION_IDS,
    MATERIAL_REACTION_RULES,
    MATERIAL_REACTION_OUTCOME_IDS,
  });
  assert(ok === true, 'validation returns true');
});
