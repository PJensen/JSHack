# Item Complexity Architecture Plan

## Purpose

Define a practical path to reach high-complexity, event-driven item behavior (like Water/Holy/Unholy Water) while preserving JSHack constraints:

- `rules -> bridge -> display` separation
- ECS scheduler ownership of execution order
- no system-to-system calls
- deterministic behavior and Deno-first testing

---

## Architectural Goal

Move from ad-hoc item handling to a consistent model where:

1. Item definitions declare rich verb hooks and metadata.
2. Item hooks emit deterministic domain events.
3. Resolver systems in scheduler phases consume those events and apply world changes.
4. Complex behavior remains composable, testable, and replayable.

---

## Core Design Decisions

### 1) Canonical item action contract in `rules`

Introduce one action context contract used by all item verbs (`quaff`, `dip`, `throw`, `pour`, `apply`, `offer`, etc.).  
Hooks must be deterministic and must communicate effects via emitted events.

### 2) Event-driven item outcomes

Item hooks never call systems directly.  
Effects are resolved by dedicated systems handling event families (`wetness`, `BUC`, `mixing`, `tile wash`, `status reactions`, etc.).

### 3) One-file complex thing policy

When a gameplay object reaches a high interaction surface area, it may be modeled as a **single domain file** that contains:

- identity/appearance metadata
- verb hooks
- internal helper functions
- invariants and failure mode notes

Scope rule:
- this is acceptable for one coherent domain object (for example: water)
- shared cross-item logic must still be extracted into reusable helpers/systems
- resolver effects remain outside the item file in systems

Rationale:
- keeps the full behavior model discoverable in one place
- reduces accidental fragmentation for highly coupled item semantics
- still respects ECS and scheduler boundaries

---

## Phase Plan

## Phase 1: Vertical Slice (Water only)

Implement one full slice for water before generalizing.

1. Add minimum required components:
- `ItemDefRef`
- `Beatitude`
- `LiquidProps`
- `PendingItemAction` (or equivalent intent/action component)

2. Add action dispatch:
- `itemActionSystem` resolves verb intents and calls item hook by definition

3. Implement water with limited verb set first:
- `on_quaff`
- `on_dip`
- `on_throw` + `on_projectile_impact`

4. Add resolver systems for immediate needs:
- burning extinguish
- wetness status
- rust/material reaction
- holy/unholy trait reaction

5. Add deterministic tests:
- unit tests per hook (expected emitted events)
- integration test per action chain

Exit criteria:
- one water action per tick resolves consistently with fixed seed
- no direct system-to-system calls
- all new behavior covered by tests

## Phase 2: Event Taxonomy and Safety Rails

1. Define event namespace/constants and payload docs.
2. Add dev-time payload validation where useful.
3. Add explicit regression tests for known failure modes:
- double consumption on throw and impact
- protection bypass (wetness applied despite waterproof state)
- beatitude and derived water type desync
4. Add lightweight replay/audit logging hooks for item action traces.

Exit criteria:
- event contract is stable and documented
- regression tests lock common failure paths

## Phase 3: Generalize to Item Families

1. Extract reusable helpers from water slice:
- beatitude derivation
- wetness emission helpers
- BUC attempt emitters
- projectile break/impact flow helper

2. Migrate potion family to same action contract.
3. Extend model to other families (scrolls, wands, food) using the same dispatcher + resolver pattern.

Exit criteria:
- multiple item families use same contract
- new item complexity is additive (mostly data + hook entries)

---

## System Wiring Strategy

In `configureWorld()`:

1. Install item-domain listeners once using Symbol guards:
- `Symbol.for('jshack:itemActions:installed')`
- `Symbol.for('jshack:wetnessResolvers:installed')`
- `Symbol.for('jshack:bucResolvers:installed')`

2. Register resolver systems in phases:
- intents: action intent capture/normalization
- effects: event resolution and state mutation
- cleanup: transient event cleanup

---

## Testing Strategy

Tests are mandatory for each new system/hook.

1. Unit tests:
- each item hook emits expected events for fixed inputs
- each resolver transforms state correctly for fixed event payloads

2. Integration tests:
- `intent -> action dispatch -> emitted events -> resolver effects`

3. Determinism tests:
- same seed + same input sequence => same output state/events

---

## Commit and Scope Discipline

Follow "one subsystem per session":

1. components
2. dispatcher system
3. water definition/hook set
4. resolver system(s)
5. tests

Keep commits focused and message clearly (no catch-all mega commits).

---

## Immediate Next Implementation Step

Build Phase 1 as the first vertical slice:

1. create item action contract + dispatcher
2. implement water hooks for `quaff`, `dip`, `throw/impact`
3. add minimal resolver systems
4. add deterministic tests before broadening scope
