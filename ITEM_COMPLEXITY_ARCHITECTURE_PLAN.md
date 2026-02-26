# Thing Complexity Architecture Plan

## Purpose

Define a practical path to reach high-agency, high-complexity simulation objects across JSHack (items, weapons, monsters, social NPCs) while preserving core constraints:

- `rules -> bridge -> display` separation
- ECS scheduler controls ordering
- no system-to-system calls
- deterministic, replayable behavior
- Deno-first testing

This plan treats each complex object as a **thing contract**, not a one-off content script.

---

## North Star

Each thing should be:

1. Self-describing: identity, appearance, policy, affordances, invariants.
2. Event-native: hooks emit events, resolver systems apply outcomes.
3. Deterministic: all randomness routed through world/query services.
4. Composable: cross-domain behavior without direct subsystem coupling.
5. Auditable: failure modes and assumptions are explicit.

---

## Canonical Thing Definition Spec

Standardize one schema shape for all high-complexity things.

## Required sections

1. `identity`: `id`, `kind`, `name`, `tags`, visual identity.
2. `state defaults`: stable per-instance defaults (brain, ledger, properties).
3. `affordances(ctx)`: current available actions for UI/planning, mobile-first prompts.
4. `verbs`: registry of callable hooks.
5. `hooks`: `on_*` behavior entry points that emit events and return deterministic results.
6. `policy`: generation, wishability, ownership, legality, alignment, economy constraints.
7. `debug`: invariants + common failure modes.

## Optional sections

1. `appearance` / unknown-vs-identified presentation.
2. `economy` appraise/shop pricing contracts.
3. `serialization` helpers for derived properties.
4. `telemetry` hints for audit logging.

Schema rule:
- do not invent ad-hoc top-level shapes per file
- extend via optional sections, not custom mini-frameworks

---

## Complexity Layering Model

Use the same layered structure for every complex thing.

## Structural layers (always)

1. Layer A: static identity (`id`, tags, visuals, material, slots, uniqueness).
2. Layer B: action surface (verbs, affordances, gating checks).
3. Layer C: effect contract (event emissions only).
4. Layer D: policy envelope (economy, legality, generation, ownership, alignment).
5. Layer E: observability (invariants, failure modes, audit trace points).

## Behavior rollout layers (implementation sequence)

1. Layer 1: core verbs + minimal resolver effects.
2. Layer 2: cross-system interactions (combat/status/material/altar/economy).
3. Layer 3: edge behavior (environment, director logic, pricing, anti-exploit, audit).

---

## Event Taxonomy Standard

Complexity only scales with one shared event language.

## Event namespaces

- `item.*`
- `combat.*`
- `damage.*`
- `status.*`
- `tile.*`
- `field.*`
- `buc.*`
- `altar.*`
- `boss.*`
- `shop.*`
- `alignment.*`
- `economy.*`

## Contract rules

1. Stable payload shape per event name.
2. Deterministic payload values only.
3. No hidden side effects in hooks.
4. Hook output is event emission + `ok/fail`.
5. Resolver systems own mutation and conflict resolution.

---

## Verb Intent vs Effect Resolution

Enforce this split universally:

1. Thing hook: validates context, emits intent/effect events, returns.
2. Resolver systems: process events in scheduler phase order.
3. Cleanup systems: clear transient intents/events.

This is the key safeguard against cross-system coupling and order bugs.

---

## One-File Complex Thing Policy

A complex thing may be modeled in one file when behavior is tightly coupled and domain-coherent.

File can include:

- metadata
- affordances
- verb hooks
- helper routines
- policy + debug sections

Boundary rules:

1. Shared mechanics stay in resolver systems/helpers.
2. No direct calls into other systems.
3. No display-layer imports in rules thing files.
4. Per-thing file is allowed; per-thing framework is not.

---

## Phase Plan

## Phase 0: Standardization Foundation

1. Publish `Thing Definition Spec` doc in-repo.
2. Define event taxonomy and payload contracts.
3. Add one dispatcher pattern for thing verbs.
4. Add contract validation helpers for dev/test.
5. Add test harness helpers for hook-level deterministic assertions.

Exit criteria:

- one schema shape is documented and used
- one event taxonomy is documented and enforced in tests

## Phase 1: Water Vertical Slice (systemic hub)

1. Implement water as a full thing contract.
2. Start with `quaff`, `dip`, `throw/impact`.
3. Build minimal resolver set: wetness, burning removal, rust, holy/unholy reactions.
4. Add regression tests for double-consume and protection checks.

Exit criteria:

- full deterministic action chain works
- event contracts are stable

## Phase 2: Artifact Weapon Vertical Slice (combat-policy hybrid)

1. Implement one artifact weapon contract (Grayswandir class).
2. Cover wield/unwield/attack/throw/invoke flows.
3. Normalize channel-based damage payloads and policy hooks (wish/enchant/shop).
4. Add tests for alignment gating, channel composition, throw/return lifecycle.

Exit criteria:

- weapon complexity composes with existing combat/economy systems through events only

## Phase 3: Complex Actor Slices (director and social law engines)

1. Implement one boss contract (Wizard class) with phase-driven AI.
2. Implement one shopkeeper contract (ledger + theft + pursuit policy).
3. Add resolver systems for boss director events and shop law/economy events.
4. Add determinism tests around cooldown persistence, pursuit transitions, billing integrity.

Exit criteria:

- high-agency AI and social/economy behavior are expressed as thing contracts plus resolvers

## Phase 4: Catalog Scale-Out

1. Migrate other items/monsters/NPCs onto the same contract gradually.
2. Prefer reaction tables and shared helpers over bespoke logic duplication.
3. Enforce acceptance rubric before merge.

Exit criteria:

- complexity is cheap to replicate
- new things follow one lifecycle pattern

---

## Acceptance Rubric (per new thing)

A new complex thing is done only if all are true:

1. Uses canonical schema sections.
2. Exposes affordances for UI/planning.
3. Uses verbs/hooks with event-only side effects.
4. Declares policy envelope (generation/economy/alignment/ownership as applicable).
5. Includes `debug.invariants` and `debug.commonFailureModes`.
6. Has unit tests for hook emissions.
7. Has integration tests for resolver outcomes.
8. Passes deterministic replay for fixed seed + input sequence.

---

## Biggest Risk and Controls

Primary risk: **inconsistent over-modeling** (each thing becomes complex in a different dialect).

Controls:

1. one contract
2. one event taxonomy
3. one dispatcher lifecycle
4. schema validation in tests
5. rubric gate on pull requests

---

## Immediate Next Planning Step

Write a compact `THING_CONTRACT_CHECKLIST.md` that mirrors the rubric and is used as the merge gate for every new high-complexity thing definition.
