# JSHack Exhaustive Cleanup Plan

## Context

JSHack is a zero-dependency, pure ES module, browser-based roguelike (~42k LOC, 295 files) with strict architectural separation (rules/display/bridge/main) and a Deno test suite (474 tests). The codebase is well-architected but has accumulated dead code, silent error handling, a monolithic 4,671-line `main.js`, and disabled tooling. This plan addresses all identified hygiene issues in priority order. All work happens directly on master.

**Baseline**: 474 passed, 1 pre-existing failure (bleed effect test in `effects.test.mjs:178`)

---

## Phase 1: Quick Wins — DONE

- [x] 1.1 Deleted dead `petFollowSystem.js` (73 lines); updated `petPlacement.test.mjs` to use `petBehaviorSystem`
- [x] 1.2 Created `petConstants.js`; updated `petBehaviorSystem.js` to import shared constants
- [x] 1.3 Deleted empty `src/bridge/schema/mapView.js`
- [x] 1.4 Deleted `src/rules/data/quarentine/` (3 files); updated guard test to verify folder is gone
- [x] 1.5 Removed 4 lines of commented-out particle stats/FPS debug rendering from `main.js`
- [x] 1.6 Gated `[DUNGEON]`/`[DEBUG]` logs behind `runtimeConfig.debug` (`?debug` URL param); switched `?give`/`?effects` to `console.debug`; removed unconditional log in `version.js`. Added `debug` flag to `runtimeConfig.js`.

---

## Phase 2: Empty Catch Block Triage (94 across 38 files)

### 2.1 Categorize all 94 empty catches — Medium
Audit every `catch {}` and `catch { }` across the codebase. Classify each as:
- **A) Intentional** — ECS `world.add()` throws on duplicate component; `world.emit?.()` defensive pattern. These are known ECS-js idioms.
- **B) Should log** — event emission failures, UI dispatch failures, data parsing. Silence hides real problems during development.
- **C) Error-hiding** — catches around substantive logic (combat resolution, save/load, item creation) that mask bugs.

### 2.2 Fix Category C catches (error-hiding) — Small–Medium
Add proper error handling: re-throw, `console.error`, or handle the specific error case.

### 2.3 Add minimal logging to Category B catches — Medium
Add `console.warn` or `console.debug` so failures are visible during development but filterable in production.

### 2.4 Document Category A catches — Small
Add brief inline comments: `// add may throw if component already exists; safe to ignore`

**Key files by catch count**: `main.js` (20), `shopStock.js` (9), `hud.js` (6), `shopWiring.js` (5), `mutations.js` (4), `combatSystem.js` (3), `interactionSystem.js` (3)

**Risks**: Fixing Category C catches may surface previously hidden bugs. This is intentional — fix the surfaced bugs before moving on. Category A catches (`world.add`) must NOT be changed to `world.set` without verifying semantics.

---

## Phase 3: main.js Decomposition (4,671 → ~2,200 lines)

Follow the project's own extraction pattern — `src/main/` already has modules like `activeSpellController.js`, `hudFeeds.js`, `messageLog.js`.

### 3.1 Wire up already-extracted `activeSpellController.js` — Small
- `main.js:296-336` duplicates `learnedSpells()`, `getPlayerMana()`, `ensureActiveSpell()`, `setActiveSpell()`, `updateActiveSpellLabel()` from `src/main/spells/activeSpellController.js`
- Replace inline versions with imports from the existing module
- Wire up `_pendingSpellTargeting` interaction since inline `setActiveSpell` also clears targeting
- **Verify**: Cast a spell in-game; spell selection UI works

### 3.2 Extract throw FX controller — Medium
- **State**: `_thrownItemFx`, `_hiddenThrownItemIds`, `THROW_FX_*` constants (~lines 263-290)
- **Logic**: `computeThrowRange()`, `isSimUiBlocked()`, `syncSimInputLockFlag()` + throw animation tick/render code
- **Target**: `src/main/fx/throwFxController.js`
- **Interface**: Factory/init function accepting `bctx`, `cam`, `TILE_PX` — no new globals
- **Verify**: Throw an item in-game; arc animation plays correctly

### 3.3 Extract bolt/lightning FX — Medium
- **State**: `_boltFx`, `_lightPulses`, `DEITY_WRATH_VFX`, `_deityWrathBoltFx`, `_deityWrathPulses`, `_deityWrathScreenFlash`, `_deityWrathScreenBoltFx`, `clamp01()` (~lines 1240-1440)
- **Target**: `src/main/fx/boltFxController.js`
- **Verify**: Trigger lightning bolt spell or deity wrath event

### 3.4 Extract remaining spell FX — Large
- **Arrays**: `_blinkFx`, `_meteorFx`, `_blastwaveFx`, `_frostBeamFx`, `_frostImpactFx`, `_arrowFx`, `_plasmaCloudFx`, `_poisonCloudFx` (~lines 1465-1940 spawn code + corresponding render sections)
- **Target**: Group by type:
  - `src/main/fx/spellFx.js` (blink, meteor, blastwave, frost)
  - `src/main/fx/projectileFx.js` (arrows)
  - `src/main/fx/cloudFx.js` (plasma, poison)
- **Strategy**: Name magic numbers as constants during extraction (combines with Phase 5.1)
- **Verify**: Test each spell type visually in-game — highest-risk extraction

### 3.5 Extract debug commands — Small
- `?give` handler (lines 543-589) and `?effects` handler (lines 591-640+)
- **Target**: `src/main/debug/debugCommands.js`
- Self-contained blocks gated by `runtimeConfig` parameters

### 3.6 Extract camera/scene debug controls — Small
- Keydown handler for zoom (+/-), camera debug (9), shake (X), delete-save hotkey (lines 4607-4657)
- **Target**: `src/main/debug/sceneControls.js`

### 3.7 Extract UI data providers — Medium
- `ui:requestInventoryData`, `ui:requestUsableItemsData`, `ui:requestThrowableItemsData` and similar `addEventListener` blocks (~lines 846-960)
- **Target**: `src/main/ui/inventoryDataProvider.js`
- **Verify**: Open inventory overlay; verify items display correctly

### 3.8 Extract boot/resize/DPR code — Small
- Canvas setup, resize handler, DPR calculation, boot progress tracking (~lines 97-189)
- **Target**: `src/main/bootstrap/canvasSetup.js`

**After Phase 3**: main.js should be ~2,000-2,500 lines (render loop, particle emitter reconciliation, world view caching, remaining wiring).

**Key risk**: FX code reads/writes shared variables (`cam`, `bctx`, `TILE_PX`, `fx.pool`, `ftext`, `world`). Each extraction needs a clean interface — pass as parameters to factory/init, do NOT create new globals.

---

## Phase 4: Disabled Tooling Cleanup

### 4.1 Delete `.eslintrc.cjs` — Trivial
Entirely commented out. If linting is desired later, `deno lint` aligns better with the project's Deno-first tooling.

### 4.2 Uncomment `jsconfig.json` — Trivial
Provides passive IDE benefit (autocomplete, type checking) with zero runtime cost and no build step.

---

## Phase 5: Polish (Low Priority, Do Incrementally)

### 5.1 Name magic numbers in FX code — Large
Replace literals like `0.45 + Math.random() * 1.35` with named constants. Do per-extraction in Phase 3 rather than a single massive pass.

### 5.2 Reduce `@ts-ignore` in `overlay.js` — Medium
24 `@ts-ignore` comments; replace with minimal JSDoc types or `/** @type {any} */` inline casts where possible.

### 5.3 Consider CSS extraction for `hud.js` inline styles — Medium–Large
28 `Object.assign(el.style, {...})` calls. Consider a shared `hudStyles.js` module. Test mobile viewport carefully — touch layout is primary.

### 5.4 Track TODO at `main.js:2291` — N/A
"Need item selection for fetch" — feature work, not cleanup. Create a GitHub issue if desired.

---

## Risks & Watch-Outs

| Risk | Mitigation |
|------|-----------|
| FX extraction breaks visual rendering | Test each FX type in-browser after extraction; pass `bctx`, `cam`, `TILE_PX` as params to factory |
| Empty catch fixes surface hidden bugs | Intentional — fix surfaced bugs before moving on |
| ECS `world.add()` catches are intentional | Classify as Category A; document with comments, don't change behavior |
| overlay.js (2,962 lines) is large | Deliberately excluded — tightly coupled internal state requires separate deep analysis |
| Mobile layout breaks from style changes | Test with Chrome DevTools device mode after any UI/FX change |
| Determinism violation | All changes are display/main layer or dead-code removal. No rules-layer logic touched. `Math.random()` in FX is display-side only per SEPARATION_MANIFEST |

## Verification

After each phase: `deno test --no-check --allow-read tests/` — must match baseline (474 pass, 1 pre-existing fail). After FX/UI changes: smoke-test in browser on desktop and mobile viewport.

## Critical Files

- `src/main.js` — primary decomposition target (Phases 2–3)
- `src/main/spells/activeSpellController.js` — already extracted, needs wiring (Phase 3.1)
- `src/main/config/runtimeConfig.js` — now has `debug` flag (Phase 1 addition)
- `src/main/scheduler.js` — system registration reference
- `src/display/ui/overlay.js` — 2,962 lines, Phase 5.2 target
- `src/display/ui/hud.js` — 818 lines, Phase 5.3 target
- `.eslintrc.cjs` / `jsconfig.json` — Phase 4 targets
