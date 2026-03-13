# Damage Pipeline Technical Memo

## Date
February 16, 2026

## Purpose
Document the damage-pipeline consolidation, current guarantees, validation status, and remaining work.

## Background
Damage application had drifted into many one-off `Vitality.hp` mutations across systems and scripts. That caused:

- Inconsistent invulnerability handling
- Inconsistent event emission (`damage` vs `damaged`)
- Ad-hoc death emission behavior
- Difficult-to-audit gameplay regressions

The codebase now converges on a single canonical damage path.

## Canonical Rule
All HP reduction in rules code must route through:

- `src/rules/utils/dealDamage.js`

Direct HP subtraction in rules code is prohibited outside that utility.

## Pipeline Contract
`dealDamage(world, spec)` now owns:

1. Target and amount validation
2. Invulnerability gate (`isEntityInvulnerable`)
3. Resistance resolution by damage type
4. HP subtraction
5. Unified `'damaged'` event emission
6. Unified `'died'` emission on lethal damage
7. Structured return result (`applied`, `killed`, `amount`, `reason`, etc.)

## Event Standardization
Damage event semantics are now:

- Use `'damaged'` (not `'damage'`)
- Use `'died'` only from `dealDamage`

This keeps listeners deterministic and removes split event contracts.

## Key Fixes Completed

### 1) Monster `onDamaged` hooks
- `affixTriggerSystem` now executes monster `onDamaged` callback arrays through `CombatCallbackContext` + `runCallbackList`.
- Integration tests verify real combat path behavior (including demon hellfire retaliation and skeleton reassemble) via:
  - `tests/monsterOnDamagedIntegration.test.mjs`

### 2) Tombstone killer attribution
- Tombstone listener now records killer attribution even when `cause` is present.
- Edge case (mutual-kill retaliation cascade) is covered:
  - `tests/tombstoneKillerAttribution.test.mjs`

### 3) Pipeline unit coverage
- New tests validate `dealDamage` behavior:
  - invulnerability
  - resistance resolution
  - bypass flags
  - event payloads
  - death emission
- File:
  - `tests/dealDamage.test.mjs`

## Audit Snapshot
Current audit confirms:

- HP subtraction is centralized to `src/rules/utils/dealDamage.js`.
- No legacy `world.on/emit('damage', ...)` usage remains in `src/`.
- `'died'` emission is centralized to `dealDamage`.

## Known Limitation (Intentional/Outstanding)
Equipment/affix-driven elemental resistances are not yet fully wired as an equip-time stat pipeline.

Implication:
- A hypothetical "Ring of Fire Resistance" will only work if it writes to `Resistances.thermal.burnMult` (or equivalent) through explicit rules logic.
- Current equipment derived stats focus on combat/economy modifiers and do not automatically project full resistance fields.

## Engineering Policy Going Forward

1. New damage features must call `dealDamage`.
2. No new direct HP subtraction callsites.
3. New listeners should consume `'damaged'`/`'died'` contracts only.
4. Any exception (`bypassInvuln`, `bypassResist`, `noTrigger`) must be explicit at callsite with gameplay rationale.

## Recommended Next Step
Implement resistance projection from equipped items/affixes into the `Resistances` component so itemized elemental defense (e.g., fire resist rings) works as first-class gameplay, not ad-hoc script logic.
