# Component/Phase/System/Event Doctrine Review

Review target: pasted memo titled "Technical Memo: Components, Phases, Systems,
and Events in `ecs-js`".

Verdict: mostly aligned with JSHack doctrine, but not safe to adopt unchanged.
The main risk is any reading that lets events become a rules-side mutation path.

The memo's central rule is compatible with this repo:

```txt
Components carry truth.
Phases advance truth.
Systems process rules.
Events describe what happened.
Extensions attach observers/adapters.
```

That matches the local separation model: rules mutate deterministic simulation
state, scheduler phases own ordering, events describe outcomes, and display,
audio, VFX, UI, debug, and telemetry consume those outcomes.

## Violations

### 1. Events must not drive rules-side mutation

The pasted memo says events are "best used" as presentation / observation
exhaust. That is directionally right, but too soft for JSHack.

For this repo, the hard rule is:

```txt
Events describe rules outcomes.
Events do not produce rules outcomes.
```

A rules-side listener that mutates durable simulation state is a hidden system.
It bypasses scheduler phase ordering, makes causality harder to inspect, and
turns `world.emit(...)` into an implicit command bus. That weakens determinism
because rule mutation is no longer visible in the ordered system list.

If a rules outcome must be consumed by later rules work, use one of these
instead:

- Component state.
- Runtime topology.
- Changed markers.
- Phase ordering.
- A registered system in the correct phase.
- A phase-local resolution record.

Rule-side event listeners are allowed only when they are effectively adapters
that translate an already-decided outcome into scheduled state for a later
system, and even then they should be treated as migration pressure. The better
long-term shape is usually a real system with explicit ordering.

### 2. Non-canonical phase examples

The memo lists example phases including:

```txt
movement
combat
presentation
```

That is misleading as JSHack doctrine. The canonical scheduler phases are:

```txt
ai
intents
effects
scripts
cleanup
```

`movementSystem` and `combatSystem` are systems in the `intents` phase, not
separate phases. Presentation is not a rules scheduler phase; it belongs outside
the deterministic rules scheduler in bridge/display wiring.

If the memo is kept as generic `ecs-js` advice, those names should be clearly
marked as examples only. If it becomes JSHack doctrine, they should be replaced
with the canonical five-phase schedule.

### 3. `ActiveEffects` as a component precedent

The memo includes `ActiveEffects` in a list of ordinary durable simulation
components. That conflicts with the runtime topology ratchet when read as
forward-looking doctrine.

JSHack still has legacy array-backed status state, but
[Runtime Topology Doctrine](RUNTIME_TOPOLOGY_DOCTRINE.md) explicitly treats this
shape as discouraged compatibility state:

```js
ActiveEffects: {
  effects: []
}
```

For new or touched runtime status work, the preferred doctrine is an attached
runtime node such as:

```txt
actor
  StatusEffectNode
    Duration
    Source
    StatModifier
    DerivedExpression
    ProcNode
```

The memo's component examples should use flat facts such as `Position`,
`Vitality`, `Threat`, `SleepState`, `Projectile`, `Faction`, and `ItemInfo`, or
explicit topology-node components such as `StatusEffectNode`. It should not
present `ActiveEffects` as the model for future runtime multiplicity.

## Non-violations

The following parts are aligned with local doctrine:

- Events should describe outcomes, not determine rule truth.
- Mutable `beforeHit` / `hit` event-hook contexts are suspicious because they
  let rules escape phase ordering.
- Systems should not call other systems directly.
- Durable rule state belongs in components, changed markers, topology, or
  phase-local records rather than event-listener side effects.
- Extensions and listener installers are acceptable for observation, bridges,
  diagnostics, and runtime setup. Any listener that mutates simulation truth
  should be treated as suspect until it has explicit scheduler-order reasoning.

## Adoption Guidance

Keep the compact rule, but normalize the examples before promoting the memo to
project doctrine:

```txt
Components are memory.
Phases are time.
Systems are law.
Events are traces.
Extensions are attachments.
```

For JSHack-specific text, say:

```txt
The rules scheduler phases are ai, intents, effects, scripts, cleanup.
Movement and combat are systems inside intents.
Presentation is bridge/display work, not a rules phase.
Runtime multiplicity is child topology, not arrays on one component.
Events are receipts, not commands; they must not be the normal path for mutating
rules-side state.
```

## Current Code Violations

The stricter event boundary is not just theoretical. The current codebase has
rules-side listeners that mutate durable rule state in response to events.

Clear examples:

- [src/rules/systems/threatSystem.js](../../src/rules/systems/threatSystem.js)
  installs listeners for `damaged`, `threat:add`, spell events,
  `taunt:applied`, and threat-drop events, then directly mutates `AggroState`
  threat records through `addThreat`, `forceThreatTarget`,
  `clearThreatFromSource`, and `reduceThreatFromSource`.
- [src/rules/utils/sleep.js](../../src/rules/utils/sleep.js) listens for
  `damaged` and directly wakes an actor by mutating `SleepState`.
- [src/rules/utils/electrocute.js](../../src/rules/utils/electrocute.js)
  listens for `damaged` and directly applies stun, blindness, and deafness
  status state.
- [src/rules/systems/itemDestructionSystem.js](../../src/rules/systems/itemDestructionSystem.js)
  listens for `damaged` and directly transforms or destroys inventory items.
- [src/rules/systems/aiChaseSystem.js](../../src/rules/systems/aiChaseSystem.js)
  listens for `damaged` and `stealth:offense`, then directly mutates
  `AggroState` alert fields.
- [src/rules/systems/scoreSystem.js](../../src/rules/systems/scoreSystem.js)
  listens for `died` and directly mutates the player's `Score`.
- [src/rules/utils/disposition.js](../../src/rules/utils/disposition.js) and
  [src/rules/utils/reputation.js](../../src/rules/utils/reputation.js) consume
  offense/disposition events and directly mutate social/reputation state.
- [src/rules/systems/deitySystem.js](../../src/rules/systems/deitySystem.js)
  consumes many world events such as `died`, `damaged`, `healed`,
  `shrine:touch`, and terrain/crafting events, then directly mutates deity
  standing, wrath, cooldown, offering, gift, and resurrection state.

Borderline but less severe:

- [src/rules/systems/trapSystem.js](../../src/rules/systems/trapSystem.js)
  listens for `moved` and records arrivals into a world-local queue that
  `trapSystem` later consumes in scheduler order. This still uses an event as
  a rules handoff, but the durable mutation is performed by a registered system.
- [src/rules/systems/cleanupSystem.js](../../src/rules/systems/cleanupSystem.js)
  listens for `damaged` and records death-impact scratch data into a
  world-local map for `cleanupSystem`. This is phase-local metadata rather than
  durable game truth, but it is still hidden coupling and should stay narrow.

Preferred migration shape:

```txt
event listener mutates rule state
  -> producer writes/updates component, marker, topology node, or phase-local record
  -> registered system consumes it in the appropriate phase
  -> system emits presentation/debug events after committing rule outcomes
```
