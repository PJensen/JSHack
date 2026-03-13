# Final Stats & Proc Architecture

This document records the architecture that actually landed in JSHack after the stat/proc migration. It is intended as an operational handoff for future agents and maintainers.

This is not the original memo. It is the current runtime truth.

## Goals

The current architecture is built around three rules:

1. Authored facts live in ECS components.
2. Passive truth resolves through hierarchy-aware stat evaluation.
3. Triggered behavior resolves through proc topology plus explicit event context.

The old model of direct affix callback dispatch in combat is no longer the runtime center of gravity.

## Core Split

There are now two different evaluators:

- Passive evaluator:
  - answers "what is true about this actor right now?"
  - resolves base stats + derived expressions + equipment topology
- Proc evaluator:
  - answers "what happens when this event passes through this actor's attached proc topology?"
  - evaluates gates/effects/scripts into an accumulator, then applies mutations in a separate step

Keep that split clean. Do not put event-driven behavior into passive resolution, and do not use procs to re-derive always-on stats.

## Stat Tree

### Canonical authored inputs

Primary passive authored state is carried by:

- `BaseStats`
- `ItemInfo.bonuses`
- affix passive script refs from the affix registry
- any attached `DerivedExpression` topology

Important files:

- `src/rules/components/BaseStats.js`
- `src/rules/components/DerivedExpression.js`
- `src/rules/utils/derivedStats.js`
- `src/rules/utils/passiveBonuses.js`

### Topology model

Passive stat resolution walks hierarchy and equipment topology.

`gatherStatTopology(world, actorId)` currently includes:

- the actor entity subtree
- all equipped non-ammo gear subtrees

That means passive contributors can live:

- directly on the actor
- under equipped items
- under child entities of those items

This is the structural provenance model. If a stat came from a gem, affix-derived node, buff entity, or future socket child, it should be visible in topology.

### Derived expressions

Always-on formula nodes are represented by `DerivedExpression`.

Supported kinds:

- `addConst`
- `addStatScale`
- `mulConst`
- `minConst`
- `maxConst`
- `overrideConst`

Supported stages:

- `base`
- `derived`
- `final`

Ordering is deterministic:

1. stage
2. priority
3. entity id

Do not bypass this with ad hoc manual stat mutation if the contribution is meant to be passive truth.

### Passive outputs

There are two important passive projections:

1. `ResolvedStats`
- resolved from `BaseStats` plus `DerivedExpression`
- implemented in `src/rules/utils/derivedStats.js`

2. `PassiveBonuses`
- compatibility/read-model bag for broader equipment-style bonuses and affix passive scripts
- implemented in `src/rules/utils/passiveBonuses.js`

This means the passive system is still hybrid:

- `ResolvedStats` is the cleaner stat-tree direction
- `PassiveBonuses` remains the bridge for broader legacy equipment bonus vocabulary

That is acceptable for now. Future work should prefer moving passive truth into explicit stat expression topology where practical.

### Consumers

Live systems should read passive truth through:

- `resolveDerivedStats(...)`
- `getPassiveBonuses(...)`
- `resolveCombatSnapshot(...)`

They should not read `Equipment.*Derived` as canonical truth.

`Equipment.*Derived` still exists as compatibility surface but is not the source of truth.

## Proc Tree

### Core proc components

Proc topology is expressed with:

- `ProcNode`
- `ActivationGate`
- `ProcEffect`
- `ScriptRef`

Important files:

- `src/rules/components/ProcNode.js`
- `src/rules/components/ActivationGate.js`
- `src/rules/components/ProcEffect.js`
- `src/rules/scripting.js`
- `src/rules/utils/procEvaluator.js`
- `src/rules/utils/procApplication.js`

### Authoring model

Proc content should be authored through helpers in:

- `src/rules/utils/statProcAuthoring.js`

Do not hand-author raw `{ a, b, c }` records in content unless there is a very good reason.

Use helper constructors for:

- passive expressions
- gates
- effects
- proc node attachment
- proc script attachment

### Event context

Proc evaluation runs against an inbound context object. The important shape is:

- `kind`
- `source`
- `target`
- `item`
- `damage`
- `tags`
- `scratch`

The proc evaluator assumes this context contract. If new proc surfaces are added, preserve the same shape rather than inventing one-off callback signatures.

### Gates

Supported gate kinds currently include:

- `eventKind`
- `chance`
- `critOnly`
- `sourceStatAtLeast`
- `targetTag`
- `healthBelowPct`
- `damageType`
- `hasActionTag`
- `oncePerTurn`
- `hasCharge`

These are evaluated in child order sorted by priority then entity id.

### Effects

Supported built-in effect kinds currently include:

- `bonusDamageFlat`
- `bonusDamageScaleFromSourceStat`
- `addCritChance`
- `restoreResource`
- `applyStatus`
- `attachTimedBuff`
- `spawnEntity`
- `consumeCharge`

For anything stranger than those, use a proc script.

### Script escape hatch

Proc nodes can carry `ScriptRef` and run through:

- `ScriptVerb.ProcEvaluate`

This is the intended escape hatch for weird roguelike behavior.

Proc scripts should write into the proc accumulator through `ctx.proc.*`, not mutate arbitrary world state directly unless there is no reasonable alternative.

Current proc script API includes:

- `addBonusDamage(...)`
- `addCritChance(...)`
- `restoreResource(...)`
- `applyStatus(...)`
- `attachTimedBuff(...)`
- `spawnEntity(...)`
- `consumeCharge(...)`
- `heal(...)`
- `dealDamage(...)`
- `cancel()`
- `message(...)`
- `emit(...)`

If a future mechanic feels too weird for static gate/effect vocabulary, a proc script is the correct home.

## Proc Accumulator

Proc evaluation does not mutate the world directly. It writes into an accumulator.

Current accumulator fields include:

- `bonusDamage`
- `bonusCritChance`
- `statusesToApply`
- `buffsToAttach`
- `resourcesToRestore`
- `vitalityToRestore`
- `directDamage`
- `spawnedEntities`
- `chargesToConsume`
- `cancelled`
- `messages`

Application is handled in:

- `src/rules/utils/procApplication.js`

This separation is not optional. Do not collapse evaluation and mutation back together unless you are intentionally undoing the architecture.

## Affix Runtime Form

### Registry

Affixes are no longer consumed as a raw `AFFIX_DEFS` bag. Runtime affix data comes from the affix registry in:

- `src/rules/data/affixes.js`

Important public API:

- `registerAffixDefinition`
- `unregisterAffixDefinition`
- `getAffix`
- `listAffixEntries`
- `getAffixPassiveRefs`
- `getAffixTriggerScripts`
- `getAffixTriggers`
- `affixSupportsSlot`

### Topology materialization

Affix declarations are materialized into runtime proc topology under equipped items.

Important files:

- `src/rules/components/AffixTopologyNode.js`
- `src/rules/utils/affixTopology.js`

Why `AffixTopologyNode` exists:

- affixes are still declared in `ItemInfo.affixes`
- runtime proc nodes are generated from that declaration
- the marker component identifies generated affix subtrees so they can be safely rebuilt without deleting unrelated item children

Without that marker, rebuild logic cannot distinguish:

- generated affix proc nodes
- authored socket/gem nodes
- future native item proc nodes

This is not about expressions. It is about safe generated-topology provenance.

### Current materialization behavior

`ensureAffixTopology(world, itemId)`:

- clears prior generated affix subtrees on that item
- recreates `AffixTopologyNode` children for each affix
- attaches proc nodes for trigger scripts under those affix nodes

`ensureEquippedAffixTopology(world, actorId)`:

- applies that materialization across equipped non-ammo gear

`evaluateEquippedAffixProcs(world, actorId, ctx, options)`:

- ensures topology exists
- walks equipped item proc nodes
- evaluates them into a proc accumulator

This is the current combat proc path.

## Combat Integration

### Melee

`src/rules/systems/combatSystem.js` now:

- resolves passive combat snapshot
- builds proc context for `onBeforeHit`
- evaluates equipped affix procs through topology
- rolls bonus proc damage from accumulator
- applies proc outputs
- runs monster hooks on their explicit compatibility surface
- evaluates attacker `onHit` procs
- evaluates defender reaction procs
- routes actual HP change through `dealDamage(...)`

### Ranged

`src/rules/systems/rangedAttackSystem.js` now:

- still runs projectile/ammo scripts through projectile dispatch
- also evaluates equipped affix procs through the same proc topology path
- uses ranged/projecile tags in proc context

### Damage pipeline

`src/rules/utils/dealDamage.js` is still the canonical damage path.

It now:

- emits `damaged`
- evaluates defender `onDamaged` affix procs through topology
- applies proc outputs
- runs monster `onDamaged` hooks through the monster compatibility bridge

That means the old combat-era affix trigger listener pattern is dead.

## What Is Still Legacy

Not everything was fully rebuilt into pure proc/stat trees.

The main remaining compatibility surfaces are:

1. Passive affix bonuses
- still resolved through affix passive script refs into `PassiveBonuses`
- not yet materialized as explicit passive expression topology

2. Monster hooks
- still explicit callback/hook surfaces on monster defs
- currently bridged through `legacyAffixDispatch.js`, which is now monster-only in purpose

3. Some item-use / interaction content
- already much cleaner than old combat callbacks
- but not everything is represented as proc trees, and that is fine

Do not mistake "not every mechanic is a proc tree" for failure. The main goal was to eliminate hidden combat callback soup and move passive/proc semantics onto explicit structure.

## Extension Guidance

When adding new mechanics:

### Use passive stat topology when

- the contribution is always-on
- the contribution should show up in stat explanation
- the contribution is formula-like

Examples:

- stat grants
- stat conversions
- scaling formulas
- caps/clamps

### Use proc topology when

- the behavior depends on an event
- the behavior depends on hit/crit/kill/damaged/turn gates
- multiple contributors may add to one result

Examples:

- on-hit status
- on-damaged retaliation
- crit-based resource restore
- kill triggers

### Use proc scripts when

- the mechanic is too weird for current gate/effect vocabulary
- the mechanic needs richer inspection of world state
- the mechanic involves multi-target logic, memory, transformation, or special-case roguelike nonsense

Examples:

- chain logic
- target family quirks
- item curse behavior
- environment-aware proc behavior

### Do not

- reintroduce ad hoc combat-affix callback dispatch
- mutate the world directly during proc evaluation when accumulator output will do
- add new canonical consumers of `Equipment.*Derived`
- bypass deterministic RNG in rules code
- create a second passive resolution path for the same truth

## Determinism Rules

Rules-side code must not use:

- `Math.random`
- wall-clock APIs
- hidden async timing

Use world RNG.

This is enforced by:

- `tests/determinismArchitectureGuards.test.mjs`

If a new mechanic needs randomness in rules, it must come from the deterministic world random source.

## Useful Files

Future agents should start here:

- `src/rules/utils/derivedStats.js`
- `src/rules/utils/passiveBonuses.js`
- `src/rules/utils/procEvaluator.js`
- `src/rules/utils/procApplication.js`
- `src/rules/utils/affixTopology.js`
- `src/rules/utils/statProcAuthoring.js`
- `src/rules/data/affixes.js`
- `src/rules/systems/combatSystem.js`
- `src/rules/systems/rangedAttackSystem.js`
- `src/rules/utils/dealDamage.js`
- `tests/procEvaluator.test.mjs`
- `tests/statProcAuthoring.test.mjs`
- `tests/procAffixes.test.mjs`
- `tests/legacyAffixDispatchArchitecture.test.mjs`

## Final Operational Summary

The final form of the architecture is:

- passive truth is hierarchy-aware and deterministic
- triggered truth is proc-topology-driven and accumulator-applied
- affix combat behavior is materialized into runtime proc trees
- weird mechanics still have a script escape hatch
- canonical combat mutation still flows through `dealDamage(...)`
- legacy affix callback dispatch is no longer a live combat architecture

If future work preserves those facts, it is aligned with the architecture that landed.
