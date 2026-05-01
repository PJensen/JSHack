# TODAY KICKOFF TODO (Thursday, February 19, 2026)

## Conceptual Anchor (Do Not Drift)

The architecture target is unchanged:

1. Mechanics live in canonical verb pipelines.
2. Content behavior lives in data-space hooks on defs.
3. Interactions run through one runtime with deterministic, transactional semantics.
4. Payload code uses context facets/helpers (`ctx.helpers`, with `ctx.fx` alias for compatibility), not direct world mutation.

This slice is explicitly **not** a strict 1:1 legacy port. We keep high-value behavior and drop low-value quirks.

## Current State Snapshot (Observed In Repo)

1. Hook-native item behavior is working in data:
   - `potion_stoneskin` has `on_drink`, `on_throw`, `on_dip` in `src/rules/data/itemCatalog.js`.
   - Hooks are using `ctx.helpers.*`.
2. Hook alias mapping exists:
   - `src/rules/content/items/itemHooks.js` maps snake_case to canonical hook names.
3. Runtime exposes context helper surface:
   - `ctx.helpers` is first-class in `src/rules/interaction/runtime/actionRuntime.js`.
   - `ctx.fx` currently aliases `ctx.helpers` for compatibility.
4. UI/runtime apply targeting already points to payload registry helper, not legacy import:
   - `src/main.js` imports from `src/rules/content/items/applyPayloads.js`.
5. Legacy modules still exist and should be retired/quarantined:
   - `src/rules/data/applyDefs.js`
   - `src/rules/data/itemUseDefs.js`
6. Determinism seams still exist in rules layer:
   - `Math.random()` usage found in `src/rules/systems/tombstoneSystem.js` and `src/rules/systems/ambientSoundSystem.js`.
7. Guard direction is already present:
   - `tests/interactionArchitectureGuards.test.mjs` documents banned legacy import/escape-hatch patterns.

## Work Order (Today)

## 0) Baseline Failing Tests (first move)

1. Run full or scoped suite and capture exact failures.
2. Classify each failure as:
   - hook port parity gap
   - resolver/registry mismatch
   - determinism/boundary violation
3. Fix in this order: deterministic/boundary issues first, then registry drift, then behavior parity.

## 1) Hook-Native Behavior Port Priorities

1. Port highest-play-frequency item behaviors into item defs first.
2. For each migrated item, keep behavior in hook callbacks (`on_drink`, `on_throw`, `on_dip`, `on_use`, `on_apply`) and invoke only helpers/facets.
3. Remove or quarantine legacy branches for those migrated identities.
4. Keep gameplay-significant outcomes; skip low-value legacy oddities.

Status update (Feb 19):
- Completed first migration batch for use-behaviors into item defs:
  - wands: `wand_lightning`, `wand_meteor`, `wand_frost`
  - scrolls: `scroll_blastwave`, `scroll_homecoming`
  - learn books: `book_lightning`, `book_meteor`, `book_blastwave`
  - flavor/deathlog books: `book_dead`, `book_kitty`, `book_snakes`, `book_spikes`, `book_touchstone`, `book_corpses`, `book_gridbugs`
- `usePayloads` now acts as effect-script resolver + hook dispatch bridge; matcher/direct use registries are intentionally empty for this slice.

## 2) Runtime/UI Registry Unification

1. Ensure both runtime dispatch and UI target listing use the same hook/payload resolver path.
2. Keep `applyPayloads` as the resolver source until direct hook registry abstraction is extracted.
3. Add guard tests proving UI targetability and runtime execution agree for representative tools/items.
4. Continue deprecating direct usage of `applyDefs` and `itemUseDefs`.

Status update (Feb 19):
- Added canonical apply resolver helpers in `applyPayloads`:
  - `resolveApplyPayload(reader, spec)`
  - `resolveApplyPayloadForWorld(world, spec)`
- `applyPipeline` now uses the shared resolver (`resolveApplyPayload`) instead of bespoke state/payload lookup.
- UI target listing (`listApplyTargetsForTool`) also uses the same shared resolver path.
- Added agreement tests:
  - `tests/applyResolverAgreement.test.mjs` (UI list vs runtime resolver parity, including hook-native `on_dip` tool).
- Added guard test:
  - `tests/interactionArchitectureGuards.test.mjs` now verifies UI entrypoints do not import legacy `applyDefs`/`itemUseDefs`.
- Removed hardcoded apply behavior entries from `APPLY_PAYLOADS`; touchstone + poison coat now live in item-def hooks (`stone_touchstone`, `potion_poison`).
- Quarantined legacy def modules under `src/rules/data/quarentine/` and added guard to block active-source imports from quarantine paths.

## 3) Determinism + Boundary Cleanup

1. Replace remaining `Math.random()` in rules paths touched by this slice with deterministic RNG source.
2. Remove payload-path dependence on raw world escape hatches; route behavior through explicit context facets/helpers.
3. Add/maintain tests for:
   - cancel -> discard rollback
   - commit ordering stability
   - same seed + same input replay equivalence

## 4) Slice-Level “Good Enough” Done Criteria

1. Migrated items are fully playable through hook-native pipelines.
2. No direct world mutation in migrated payload hook code.
3. Runtime and UI resolve interaction capability from one source of truth.
4. Determinism checks pass for migrated paths.
5. Legacy paths for migrated items are removed or explicitly quarantined with TODO markers.

## Notes For Next Compaction

1. We intentionally accept temporary compatibility shims (`ctx.fx` alias) while converting callsites to `ctx.helpers`.
2. We should avoid expanding old def modules; new behavior goes into data hooks + payload registries only.
3. Follow-up architecture step (already identified): unify combat/ranged status-name logic under a deterministic stat pipeline.
4. Not yet "fully data-driven":
   - Some use behavior still routes through effect-key script payloads (`consumable:*`) instead of item-def hooks.
   - Legacy files are quarantined, not deleted.
   - Transition/overworld scheduler contract tests are still failing and need stabilization.
