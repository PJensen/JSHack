# Architecture Stabilization Plan

## Diagnosis (2026-04-29)

Adding fishing rod and enchanting surfaced three rot zones that will compound with every feature added after them.

---

## Rot Zone 1: Dual Item Registries

Items live in two places simultaneously:

- **Static god files**: `src/rules/data/itemCatalogEquipment.js` (3151 lines), `src/rules/data/itemCatalogMagic.js` (3709 lines)
- **Dynamic DSL**: `src/content/items/*.js` → `installContent()` → `registerCatalogItem({override:true})` clobbers the static entry at runtime

Two sources of truth. No enforcement they agree. Adding fishing_rod meant touching the DSL file AND the god file AND palette AND loot. Drift is inevitable. The static catalogs exist only to be overridden.

**Fix**: Make DSL canonical. Port all static defs to `src/content/items/<group>.js`. Static catalogs become empty → delete. One place, one truth.

---

## Rot Zone 2: System-Level Hardcoded Identity Branches

Fishing should be a data-driven "channeled use action." Instead it is bolted directly onto the spell channeling system:

- `src/main.js:1468` — `if (identity !== 'fishing_rod') return false;`
- `src/rules/systems/castSpellSystem.js:96` — `if (identity === "fishing_rod") return itemId;`
- `src/rules/systems/channelingSystem.js` (554 lines) — fishing logic embedded in spell channeling
- `TARGETED_SPELL_CONFIG.fishing` wired manually in main.js

No "use-action" abstraction exists. Every new channeled tool (lockpick, divining rod, net, trap) repeats the full dance: god file entry + castSpellSystem branch + channelingSystem branch + main.js handler.

**Fix**: `defineUseAction({ id, validate, channelTurns, onComplete })`. Refactor fishing to use it. Kill identity branches. New tools declare themselves, they don't modify systems.

---

## Rot Zone 3: Message Wiring — 7 Files, ~3000 Lines, Pattern Repeated 20+ Times

Every combat/proc message hand-codes:

```js
if (target === 'You') { log(dangerMsg); return; }
if (actor === 'You') { log(combatMsg); return; }
log(neutralMsg);
```

Verbs, adverbs, death prose — all hardcoded lookup tables inside handlers. No template registry. No metadata-driven interpolation. `combatMessages.js` alone is 922 lines across 55 handlers.

Adding a new damage type or proc means touching every branch in every handler.

**Fix**: `defineMessage(eventKey, { actor, target, witness } → string)`. Replace three-way branches with one lookup call. Pull names/verbs/adverbs from item and damage metadata rather than hand-authored tables buried in handlers.

---

## God Files (sorted by malignancy)

| File | Lines | Smell |
|---|---|---|
| `src/rules/data/itemCatalogMagic.js` | 3709 | data + hooks + auto-generated scrolls |
| `src/rules/data/itemCatalogEquipment.js` | 3151 | data + per-item handler closures |
| `src/rules/data/monsters.js` | 2202 | def + registration logic mixed |
| `src/rules/data/procPackages.js` | 1829 | proc bundles |
| `src/rules/data/spells.js` | 1331 | clean-ish; just big |
| `src/rules/data/lootTables.js` | 1084 | |
| `src/display/ui/wiring/messages/combatMessages.js` | 922 | |

---

## Stabilization Phases

### Phase C — Use-Action Abstraction (do first, proves the pattern)

**Scope**: 1–2 days. Isolated. Proves the architecture before the slog.

Status: complete as of 2026-04-30, with compatibility aliases left in place for migration.

1. [x] Create `src/rules/content/useActions/useActionRegistry.js` — `defineUseAction`, `getUseAction`, lookup by identity.
2. [x] Port fishing to a `defineUseAction` declaration in `src/rules/content/useActions/fishingAction.js`; `src/content/items/fishingRod.js` owns the item/ability declaration.
3. [x] Remove fishing identity branches from `castSpellSystem.js` and `main.js`; main now opens item targeters through use-action metadata.
4. [x] Route channeling system through registry lookup instead of hardcoded branches.
5. [x] Document the pattern so next tool just declares, doesn't modify systems: `src/rules/content/useActions/README.md`.

Follow-up:

- Keep `defineChannelAction` / `getChannelAction` aliases temporarily only for migration; new code must use `defineUseAction` / `getUseAction`.

### Phase A — Kill Dual Registry (the slog, highest unlock)

**Scope**: ~1 week. Boring but unblocks everything else.

1. Port all static defs from `itemCatalogEquipment.js` + `itemCatalogMagic.js` to `src/content/items/<group>.js` files.
2. Ensure DSL `installContent()` remains the single registration path.
3. Delete static catalog god files once empty.
4. Split remaining large files by domain: `weapons/`, `armor/`, `scrolls/`, `potions/`, `tools/` — each under 300 lines.

### Phase B — Message Template Registry (cleanup tour)

**Scope**: Parallel to or after Phase A.

1. Create `src/display/ui/wiring/messages/messageRegistry.js` — `defineMessage(eventKey, template)`.
2. Template receives `{ actor, target, isCrit, damageType, ... }` context object. Returns `{ text, type }`.
3. Extract verb/adverb/death tables to `messageTemplates.js` as pure data.
4. Replace three-way branches with single registry lookup throughout `combatMessages.js` and peers.

### Phase D — Content Feature Manifests (authoring polish, do last)

One folder owns one feature: `src/content/fishing/` holds item + use-action + loot + messages + palette. No cross-feature registry hunting.

---

## Risk Notes

- Phase C: channelingSystem has shared mutable state; extract only read-only dispatch path, don't split the closure state (prior lesson: `feedback_spellAreaFx_approach.md`).
- Phase A: ~30 test files provide safety net. Do module-by-module, run `deno test --allow-read` between each group.
- Phase B: Pure display layer, no rules logic. Lowest risk.
- Never revert feature work to fix a test — fix the test or the architecture (CLAUDE.md rule).

---

## Execution Order

**C → A → B → D**

C proves the abstraction. A clears the ground. B cleans up communication. D is the steady state we build toward.
