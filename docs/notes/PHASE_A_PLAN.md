# Phase A Execution Plan — Kill Dual Registry

## Inventory

| Catalog | Items | Lines | Hook count |
|---|---|---|---|
| itemCatalogEquipment.js | 206 | 3105 | 2 |
| itemCatalogMagic.js | 154 | 3717 | 244 |

Equipment: nearly all pure data. Magic: ~244 hook entries (potions, scrolls, etc. all have on_use/on_drink).

## DSL Mapping

Static → DSL field conversions:
- `type:"equip", slot:"weapon"` → `type:'weapon'`
- `type:"equip", slot:"armor"` → `type:'armor'`
- `type:"equip", slot:"ring"` → `type:'ring'`
- (all other slots follow same pattern)
- `rarity:1, rarityName:"common"` → `rarity:'common'`  (resolveRarity handles it)
- `rarity:2` → `rarity:'uncommon'`
- `rarity:3` → `rarity:'rare'`
- `rarity:4` → `rarity:'epic'`
- `rarity:5` → `rarity:'legendary'`
- `id:"foo"` → first arg of `defineItem("foo", {...})`
- `catalogKind` → drop (inferred)
- `hooks: { on_use: fn }` → `onUse(ctx) {...}` DSL hook
- `hooks: { on_throw: fn }` → `onThrow(ctx) {...}`
- `hooks: { on_drink: fn }` → `onDrink(ctx) {...}`

## Port Order (lowest risk first)

### Batch 1 — Equipment: pure data, no hooks (204 items)
Target file: `src/content/items/equipment.js` (or split: weapons.js, armor.js)
- All 206 equipment items minus the 2 with hooks
- Mechanical conversion: slot name → type, rarity int → string, drop id/catalogKind
- Split into: `weapons.js` (~54), `armor.js` (~100: armor/head/legs/gloves/feet/belt), `jewelry.js` (~35: ring/neck), `ranged.js` (~10), `offhand.js` (~19)

### Batch 2 — Equipment: hooked items (2 items)
The 2 items with on_use in itemCatalogEquipment.js (likely torch + one other).
Manual port. Use `onThrow(ctx)` DSL hook or check what hooks they use.

### Batch 3 — Magic: pure-data types first
- ingredient (15), food (12), material (5), seed (3), fuel (1), junk (1) → `src/content/items/consumables.js`
- These rarely have hooks — confirm before porting

### Batch 4 — Magic: potions (26 items)
Each potion has on_drink hook → `onDrink(ctx)`. Existing DSL already handles potion.route/doses/effects.
Port to `src/content/items/potions.js`.

### Batch 5 — Magic: scrolls (18), wands (5), books (7), learn (44)
`learn` type = skill books. Port to `src/content/items/scrolls.js` and `books.js`.

### Batch 6 — Magic: tools (6) + utility (1) + misc equip (11)
Finish the tail. Port to appropriate files.

## Guardrail: run after each batch
```
deno test --allow-read tests/contentCatalogCanonical.test.mjs
```
Also run full suite: `deno test --allow-read`

## Files to delete when empty
- `src/rules/data/itemCatalogEquipment.js` (export EQUIPMENT_ITEMS = {} then delete)
- `src/rules/data/itemCatalogMagic.js` (export MAGIC_ITEMS = {} then delete)
- Check all importers first: `grep -r "itemCatalogEquipment\|itemCatalogMagic" src/`

## Importer audit (do before deleting)
These files likely import the catalogs — must update:
- `src/rules/data/itemCatalog.js` — main merger
- Any loot tables referencing EQUIPMENT_ITEMS / MAGIC_ITEMS keys by name

## Risk: WEAPON_FAMILIES
`itemCatalogEquipment.js` imports `WEAPON_FAMILIES` from `./weaponFamilies.js`.
Some items use `weaponFamily: WEAPON_FAMILIES.dagger` etc.
DSL `defineItem` currently does NOT pass `weaponFamily` through to catalogEntry.
**Check `define.js` and add `if (def.weaponFamily) catalogEntry.weaponFamily = def.weaponFamily` before porting weapons.**

## Risk: createTorchThrowHook
Equipment catalog imports `createTorchThrowHook` from `./itemCatalogHooks.js`.
Must port this closure into an `onThrow(ctx)` DSL hook — or keep it as an imported helper and call it inside the DSL hook.

## Risk: auto-generated scrolls
`itemCatalogMagic.js` has "auto-generated scrolls" comment (mentioned in ARCH doc).
Inspect those entries — they may be procedurally built in a loop, not hand-defined.
If so, port the loop logic into an installer function inside the new content file.

## Acceptance
Phase A done when:
- `tests/contentCatalogCanonical.test.mjs` passes (no shadows)
- `deno test --allow-read` green
- Both static catalog files deleted
- `src/content/items/` has ≤300 lines per file
