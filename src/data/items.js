// data/items.js
// Item / equipment / affix definitions extracted from the reference implementation.
// Pure ES module exporting named definitions for easy import.
//
// Scripts: some item/effect entries may include executable functions instead of
// strings. Those functions receive a single `api` argument with the same helper
// bindings used by the original runtime: { game, level, player, rng, log, GL, heal, damageVisible }
// and should return either a human-readable message string (optional) or undefined.
//
// JSON vs functions: If you prefer pure JSON (e.g., for tooling or editing by non-JS tools),
// keep `effect` as a DSL string (existing mini-DSL is supported). Converting to executable
// functions trades portability for clarity and performance (no runtime eval). Use whichever
// style matches your workflow; the game runtime must call the appropriate handler when using items.

import { ITEM_DEFS, itemDefs } from './item-defs.js';
import { EQUIP_DEFS, equipDefs } from './equip-defs.js';
import AFFIX_DEFS from './affix-defs.js';

// Re-export the original names so existing imports keep working while we break files apart.
export { ITEM_DEFS, EQUIP_DEFS, AFFIX_DEFS, itemDefs, equipDefs };

export default { ITEM_DEFS, EQUIP_DEFS, AFFIX_DEFS, itemDefs, equipDefs };
