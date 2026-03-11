# Derived Stats / Proc Migration Plan

## Purpose

This document is the execution plan from the newly landed foundation to full replacement of the legacy equipment-derived stat bag and callback-driven affix/proc path.

Starting point:

- `BaseStats`, `DerivedExpression`, `ActivationGate`, `ProcEffect`, and `ProcNode` now exist as ECS components.
- Hierarchy-aware passive resolution exists in `src/rules/utils/derivedStats.js`.
- Hierarchy-aware proc evaluation exists in `src/rules/utils/procEvaluator.js`.
- `ResolvedStats` and `DamageProfile` virtuals are registered during world configuration.
- Focused tests cover passive resolution and gated proc accumulation.

Ending point:

- Passive truth is resolved entirely through derived expressions.
- Triggered behavior is resolved entirely through gated proc subtrees.
- Combat, equipment, gems, buffs, and temporary overlays consume the new model.
- Legacy flat derived fields and callback-style affix execution are deleted.

## Constraints

- No build step.
- Rules-layer only. No display coupling.
- Deterministic ordering at every step.
- Systems never call other systems directly.
- New work must stay test-first and land in small slices.
- ECS hierarchy is the canonical topology for composition.

## Non-Goals

- No compatibility layer that preserves legacy design indefinitely.
- No partial “hybrid forever” architecture.
- No expansion of `ecs-js` unless a real library bug is found.
- No opaque callback islands added to new content.

## Current Architecture Gap

The codebase currently has two incompatible models:

1. The new data-first foundation
   - expression nodes
   - proc nodes
   - hierarchy traversal
   - virtual stat views

2. The legacy runtime
   - `Equipment.*Derived` flat fields
   - `resolveCombatSnapshot()` using those fields
   - callback-heavy affix execution
   - item bonuses stored as ad hoc flat bags

The plan is to move all stat and proc meaning into the new model, then collapse the old runtime around it.

## Migration Strategy

Use a staged replacement:

1. Expand the new vocabulary until it can express real content.
2. Route read paths to the new resolver.
3. Route action/proc paths to the new evaluator.
4. Port existing content.
5. Delete the legacy structures.

Each stage must leave the repo green.

## Stage 1: Stabilize Core Vocabulary

Goal:
Make the new foundation expressive enough for real combat and item content without touching the old combat systems yet.

Tasks:

- Add remaining authored-state components that the model needs.
  - `SocketLayout` or equivalent for explicit socket counts and slot metadata.
  - `TimedDuration` or reuse existing lifespan/duration components for buff entities.
  - `ResourcePool` only if current `Mana` / `Stamina` components become too awkward.
- Define canonical stat vocabulary.
  - authoritative list of passive stat keys
  - authoritative list of damage-profile keys
  - authoritative list of proc effect kinds
  - authoritative list of gate kinds
- Add resolver hygiene rules as named helpers rather than inline literals.
  - crit cap policy
  - min/max damage normalization
  - clamp policy for other resources if needed
- Add provenance/explain helpers for UI/debugging.
  - “why is critChance 0.12?”
  - “which subtree added this proc effect?”

Deliverables:

- One source-of-truth module for stat/proc vocabulary.
- Tests for unknown targets, unknown kinds, ordering, caps, and stable explain traces.

## Stage 2: Model Composition Through Hierarchy

Goal:
Make equipment, gems, buffs, enchants, and auras structurally real rather than implicit arrays and IDs.

Tasks:

- Define canonical topology patterns.
  - actor owns equipped item entities through `Equipment`
  - equipment owns socket or gem children via hierarchy
  - proc nodes own gate/effect children
  - buffs/auras are attached as child entities under the actor
- Decide whether sockets are explicit entities or implied attachment points.
  - recommended: explicit socket entities if order/capacity matter
  - acceptable first cut: gems attach directly to item with a socket-count component on item
- Add helper APIs for composition.
  - attach gem to item
  - attach buff to actor
  - enumerate all passive contributors
  - enumerate all proc contributors
- Keep inventory/storage semantics separate from combat topology.
  - inventory containment is not the same as equipped contribution
  - only equipped or explicitly attached contributors should resolve into actor state

Deliverables:

- Composition helpers in rules utils.
- Tests for attached gems under equipped items contributing to actor state.
- Tests for detached or unequipped nodes not contributing.

## Stage 3: Replace Passive Equipment Derivation

Goal:
Remove `equipmentSystem` as the source of truth for passive stats.

Tasks:

- Stop treating `Equipment.*Derived` as canonical passive output.
- Port base item bonuses into expression nodes or generated passive contributors.
  - weapon attack bonuses
  - armor defense bonuses
  - resistances
  - mana/stamina modifiers
  - hunger/vision/luck modifiers
- Decide representation for item-native passive data.
  - preferred: item authoring generates expression child entities
  - acceptable bridge: translate `ItemInfo.bonuses` into ephemeral expression inputs during migration
- Rewrite passive consumers to read `ResolvedStats` or a domain-specific projection.
  - mana regen
  - stamina regen
  - hunger rate
  - resist projection
  - vision range
- Reduce `equipmentSystem` to either:
  - a temporary compatibility shim, then
  - deletion

Deliverables:

- New passive projection helpers replacing direct reads from `Equipment.*Derived`.
- Migration tests that prove old and new results match for representative gear.

## Stage 4: Replace Combat Snapshot Read Model

Goal:
Make `resolveCombatSnapshot()` a projection over `ResolvedStats` plus status/verb-specific combat rules.

Tasks:

- Refactor `resolveCombatSnapshot()` to read `ResolvedStats` instead of `Equipment.*Derived`.
- Move mode-specific combat logic into explicit combat projection rules.
  - melee/ranged attack bonus rules
  - status penalties/bonuses
  - stoneskin and similar combat overlays
  - berserk damage multiplier
- Split “resolved passive truth” from “combat-mode projection”.
  - `ResolvedStats(actor)`
  - `CombatSnapshot(actor, mode, ctx)`
- Preserve deterministic modifier breadcrumbs for tests and debugging.

Deliverables:

- `resolveCombatSnapshot()` backed by `ResolvedStats`.
- Existing stat pipeline tests passing against the new source.
- New tests for mixed base stats + item expressions + timed overlays.

## Stage 5: Replace Proc Dispatch in Combat

Goal:
Remove callback-style affix execution from melee/ranged hit resolution and replace it with gated proc accumulation.

Tasks:

- Introduce explicit action context builders.
  - `buildHitContext`
  - `buildCritContext`
  - `buildDamageTakenContext`
  - `buildKillContext`
- Insert proc evaluation into combat flow.
  - build context
  - resolve source stats
  - resolve target stats
  - gather proc nodes from source/weapon/buffs/auras
  - evaluate gates
  - accumulate output
  - finalize damage packet
  - apply mutations later
- Replace direct affix callback execution in:
  - `combatSystem.js`
  - `rangedAttackSystem.js`
  - `affixTriggerSystem.js`
- Keep world mutation out of proc evaluation.
  - no `dealDamage()` inside gate/effect evaluation
  - no status mutation during accumulator build
  - no hidden healing inside proc node traversal

Deliverables:

- Accumulator-driven proc pass in combat.
- Tests for on-hit, on-crit, on-damaged, on-kill, resource restore, bonus damage, and status application.

## Stage 6: Move Application to Explicit Mutation Phase

Goal:
Separate evaluation from mutation cleanly.

Tasks:

- Formalize action result objects.
  - final damage packets
  - statuses to apply
  - resources to restore
  - buffs to attach
  - spawns to create
- Add or clarify an application step in the rules flow.
  - if using the current scheduler as-is, keep this inside combat resolution first
  - then move toward explicit `ActionFinalize` and `ApplyMutations` phases
- Reuse existing action transaction boundary where appropriate, but do not turn it into a second scheduler.
- Emit combat/logging events from committed results, not during speculative evaluation.

Deliverables:

- Deterministic “evaluate then apply” boundary.
- Tests proving proc evaluation itself is side-effect free.

## Stage 7: Port Existing Affixes to Data Subtrees

Goal:
Turn current affix content into explicit ECS-authored proc/passive subtrees.

Tasks:

- Audit every entry in `src/rules/data/affixes.js`.
- Classify each affix as:
  - passive expression(s)
  - proc node(s)
  - both
  - unsupported and requiring new vocabulary
- Port simple passives first.
  - guard
  - life
  - attuned
  - elemental wards
  - lucky
- Port simple proc affixes next.
  - venomous
  - frostbite
  - hemorrhage
  - mana surge
  - soul drain
- Port complex proc affixes last.
  - chain lightning
  - executioner
  - shield wall
  - second wind
- Delete per-affix callback scripts once their subtree-based equivalents are active.

Deliverables:

- Data-driven affix authoring format.
- Tests ported from current affix coverage to subtree-based equivalents.

## Stage 8: Introduce Socketed Gems as Real Contributors

Goal:
Make gems first-class structural contributors instead of inert inventory objects.

Tasks:

- Define socketing authoring rules.
  - which items can receive sockets
  - how many sockets
  - whether socket count is fixed or procedural
- Define gem-to-subtree conversion.
  - ruby -> expression/proc subtree
  - sapphire -> expression subtree
  - emerald -> cross-stat expression subtree
  - composite gems -> multiple expression/effect child nodes
- Add attach/detach socket operations and tests.
- Ensure socketed gems contribute only when installed in active topology.

Deliverables:

- Socketing data model.
- Tests for socket insertion/removal changing passive and proc outcomes.

## Stage 9: Temporary Overlays and Buff Entities

Goal:
Unify status-driven and timed passive/proc overlays under the same entity model.

Tasks:

- Represent timed buffs as attached entities with duration plus child expressions/proc nodes.
- Bridge existing status/effect systems to this topology.
  - berserk
  - stoneskin
  - poison-related modifiers
  - deity favors or temporary blessings if applicable
- Decide which existing `ActiveEffects` entries remain status records versus becoming attached buff entities.
- Add cleanup rules for expired overlay entities.

Deliverables:

- Timed buff/overlay entity pattern.
- Tests for attach-on-proc and expire-on-duration behavior.

## Stage 10: Scheduler and Phase Alignment

Goal:
Align the runtime shape with the memo’s intended phase model.

Tasks:

- Introduce or simulate these conceptual phases:
  - `Input`
  - `IntentBuild`
  - `PassiveResolve`
  - `ActionBuild`
  - `ProcEvaluate`
  - `ActionFinalize`
  - `ApplyMutations`
  - `Cleanup`
- Avoid over-rotating on scheduler surgery early.
  - first make the data flow real
  - then make the scheduler explicit
- Ensure virtual invalidation and action caches are reset at the right boundaries.

Deliverables:

- Updated scheduler documentation.
- Tests asserting proc/apply ordering.

## Stage 11: Delete Legacy Structures

Goal:
Finish the replacement.

Delete or collapse:

- `Equipment.*Derived` fields as the passive source of truth
- passive affix callback execution
- proc affix callback execution
- affix trigger listener paths that exist only for old content
- flat item bonus assumptions where replaced by expression nodes

Tasks:

- Remove compatibility shims only after all consumers have moved.
- Rewrite tests that still assert legacy internals.
- Add architecture guard tests preventing reintroduction.

Deliverables:

- Reduced `Equipment` component focused on slots/topology, not derived output.
- Architecture tests that forbid new direct affix callback paths and forbid new flat derived stat bags.

## Testing Plan

Every stage needs focused deterministic coverage.

Required test classes:

- passive expression ordering
- hierarchy inclusion/exclusion
- virtual caching and invalidation
- combat snapshot parity
- proc gate truth tables
- proc accumulator behavior
- evaluate/apply separation
- timed buff attachment and expiry
- socket insertion/removal
- migration parity for representative affixes

Add architecture guard tests for:

- no direct passive reads from `Equipment.*Derived` after cutover
- no new callback-authored affix logic
- combat systems consuming resolver/evaluator outputs rather than inline modifier logic

## Recommended Slice Order

Use this order to keep changes reviewable:

1. vocabulary + helper hardening
2. topology helpers
3. passive consumer migration
4. `resolveCombatSnapshot()` migration
5. combat proc accumulator integration
6. affix data porting
7. gem socketing
8. timed overlay migration
9. scheduler cleanup
10. legacy deletion

## Completion Criteria

The migration is complete when all of the following are true:

- Passive stats come from `ResolvedStats` and related projections.
- Combat projections do not depend on `Equipment.*Derived`.
- Proc execution in melee/ranged combat is accumulator-based.
- Affix behavior is authored as data subtrees, not callback scripts.
- Socketed gems are real attached contributors.
- Timed buffs and overlays participate through attached entities.
- Legacy derived stat fields and affix trigger shims are removed.
- Deterministic tests cover the whole path.

## Immediate Next Task

The next implementation slice should be:

1. Define canonical stat/proc vocabulary.
2. Add composition helpers for attached contributors.
3. Start migrating passive consumers off `Equipment.*Derived`.

That keeps momentum without prematurely rewriting the full combat loop in one step.
