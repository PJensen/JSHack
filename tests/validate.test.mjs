import { assert } from "jsr:@std/assert";
import { ITEM_CATALOG } from '../src/rules/data/itemCatalog.js';
import { AFFIX_DEFS } from '../src/rules/data/affixes.js';
import { EFFECT_DEFS, EFFECT_OPERATION_IDS } from '../src/rules/data/effectDefs.js';
import { APPLY_PAYLOADS } from "../src/rules/content/items/applyPayloads.js";
import {
  USE_EFFECT_PAYLOADS,
  USE_ITEM_MATCHER_PAYLOADS,
  USE_ITEM_PAYLOADS,
} from "../src/rules/content/items/usePayloads.js";
import { MATERIAL_REACTION_OUTCOME_IDS, MATERIAL_REACTION_RULES } from '../src/rules/data/materialReactions.js';
import { MONSTERS } from "../src/rules/data/monsters.js";
import { validateAll } from '../src/rules/data/validate.js';

Deno.test("data validation passes for item catalog, affixes, effects, payload hooks, monster hooks, and material reactions", () => {
  const ok = validateAll({
    ITEM_CATALOG,
    AFFIX_DEFS,
    APPLY_PAYLOADS,
    EFFECT_DEFS,
    EFFECT_OPERATION_IDS,
    USE_ITEM_PAYLOADS,
    USE_ITEM_MATCHER_PAYLOADS,
    USE_EFFECT_PAYLOADS,
    MONSTERS,
    MATERIAL_REACTION_RULES,
    MATERIAL_REACTION_OUTCOME_IDS,
  });
  assert(ok === true, 'validation returns true');
});
