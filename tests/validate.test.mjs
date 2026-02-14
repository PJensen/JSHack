import { assert } from "jsr:@std/assert";
import { ITEM_CATALOG } from '../src/rules/data/itemCatalog.js';
import { AFFIX_DEFS } from '../src/rules/data/affixes.js';
import { EFFECT_DEFS, EFFECT_OPERATION_IDS } from '../src/rules/data/effectDefs.js';
import { ITEM_USE_DEFS } from '../src/rules/data/itemUseDefs.js';
import { MATERIAL_REACTION_OUTCOME_IDS, MATERIAL_REACTION_RULES } from '../src/rules/data/materialReactions.js';
import {
  MONSTER_PROC_EVENT_SCHEMA_IDS,
  MONSTER_PROC_TARGET_IDS,
  MONSTER_PROC_TRIGGER_IDS,
  MONSTER_STATUS_PROC_DEFS,
} from '../src/rules/data/monsterStatusProcs.js';
import { validateAll } from '../src/rules/data/validate.js';

Deno.test("data validation passes for item catalog, affixes, effects, item-use, monster procs, and material reactions", () => {
  const ok = validateAll({
    ITEM_CATALOG,
    AFFIX_DEFS,
    EFFECT_DEFS,
    EFFECT_OPERATION_IDS,
    ITEM_USE_DEFS,
    MONSTER_STATUS_PROC_DEFS,
    MONSTER_PROC_TRIGGER_IDS,
    MONSTER_PROC_TARGET_IDS,
    MONSTER_PROC_EVENT_SCHEMA_IDS,
    MATERIAL_REACTION_RULES,
    MATERIAL_REACTION_OUTCOME_IDS,
  });
  assert(ok === true, 'validation returns true');
});
