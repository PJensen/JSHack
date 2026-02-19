# Technical Memo: Stat Resolution Pipeline Follow-Up

## Finding

Current combat logic still includes content-specific checks (for example, `stoneskin` by name) inside mechanics systems:

- `src/rules/systems/combatSystem.js`
- `src/rules/systems/rangedAttackSystem.js`

This works for now, but it conflicts with the architecture direction where mechanics should stay content-agnostic.

## Why This Matters

- Logic is duplicated across melee and ranged paths.
- Modifier precedence/stacking is implicit instead of explicit.
- New effects increase regression risk when each path is patched separately.
- Replay/audit/debug transparency is reduced.

## Recommended Shift

Introduce a deterministic stat resolution pipeline and make hit-resolution systems consume resolved snapshots only.

## Proposed Contract

`resolveCombatSnapshot(world, entityId, context)` returns normalized derived stats:

- `attackBonus`
- `defenseClass`
- `damage`/channels
- `resistances`
- ordered `modifiers[]` (source + reason)

Requirements:

- deterministic source ordering
- stable stacking/precedence rules
- optional audit breadcrumbs for explainability

## Architecture Alignment

- Payload hooks remain on content data defs/registries.
- ECS components remain pure data (no function values).
- Combat mechanics consume pipeline output rather than checking specific status names.

## Migration Plan

1. Extract current `stoneskin` AC behavior into resolver with parity.
2. Switch both melee and ranged systems to resolver output.
3. Add tests for parity, precedence, stacking, and determinism.
4. Remove inline status-name checks from combat systems.

## Definition of Done

- No direct status-name checks in combat systems.
- Shared resolver used by all hit-resolution paths.
- Deterministic tests pass with same seed + same inputs.
- Modifier application is auditable and transparent.
