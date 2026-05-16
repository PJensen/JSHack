# Sleep Status Design

## Purpose
Define sleep as a first-class status semantic with deeper biological backing state.
This document exists because sleep is easy to implement badly: if it is treated as
only "cannot move", sleepers still perceive, aggro, fly, channel, or leak through
alternate intent paths. If it is treated as a detached component outside the
status facade, systems split into competing truth sources.

The design goal is one canonical question:

```js
statusStrength(world, actorId, "sleep") > 0
```

and one richer backing record:

```js
SleepState
```

Sleep is a status. `SleepState` is how the rules layer stores the additional
sleep-specific facts that a plain status row cannot express.

## Non-goals
- Do not add a wand, potion, spell, or item in this pass.
- Do not design sleeping-player UX in this pass.
- Do not add display-side gameplay checks.
- Do not mirror material, monster, or sleep data into display code.

## Core Decision
Sleep belongs in the status facade.

Systems should not directly inspect `SleepState.asleep` unless they are the
sleep subsystem itself. Systems also should not scatter string checks like
`statusStrength(world, id, "asleep")` or `statusStrength(world, id, "sleep")`
when a narrower helper communicates intent better.

The facade owns the mapping:

- `SleepState.asleep === true` projects semantic status `"sleep"`.
- Existing effect/status rows may also contribute `"sleep"` if a future spell or
  proc applies sleep through the normal effect pipeline.
- Consumers ask status/facade helpers, not component internals.

## Vocabulary

### `sleep`
The canonical status key. Use this exact key for facade reads, bridge tags, data
definitions, and tests.

### `asleep`
A human-readable condition name and event reason is acceptable, but it should not
be the canonical status key. Avoid adding new rules checks for `"asleep"`.

### `SleepState`
Rules component carrying sleep-specific runtime data:

```js
{
  asleep: true,
  wakeDifficulty: 8,
  wakeRadius: 2,
  wakeOnDamage: true,
}
```

`SleepState` is not a parallel status system. It is one producer of the canonical
`sleep` status.

## Status Facade Contract
`src/rules/utils/statusFacade.js` should be the read boundary for status
semantics.

Required behavior:

1. `snapshotStatusState(world, id).statusStrengths.get("sleep")` is positive
   when `SleepState.asleep === true`.
2. `statusStrength(world, id, "sleep")` returns positive for sleeping actors.
3. `hasStatus(world, id, "sleep")` returns true for sleeping actors.
4. The facade should not require systems to know whether sleep came from
   `SleepState`, topology effect nodes, legacy `ActiveEffects`, or legacy
   `Status`.

Implementation detail:

- Importing `SleepState` into `statusFacade.js` is acceptable. The facade already
  imports component definitions and lives in rules.
- The projected status should appear in the compatibility/all-status map used by
  `statusStrength`.
- If `statuses` is intended to mean "derived only from active effects", do not
  force `SleepState` into that narrower list without first renaming or clarifying
  the snapshot fields. The important contract is `statusStrength("sleep")`.

## Sleep Helper Contract
`src/rules/utils/sleep.js` should expose intention-revealing helpers for systems
that care about sleep-specific semantics.

Recommended API:

```js
export function isAsleep(world, id) {
  return statusStrength(world, id, "sleep") > 0;
}

export function sleepPreventsAction(world, id) {
  return isAsleep(world, id);
}

export function sleepPreventsMovement(world, id) {
  return isAsleep(world, id);
}

export function sleepPreventsPerception(world, id) {
  return isAsleep(world, id);
}

export function putActorToSleep(world, id, opts) { ... }
export function tryWakeActor(world, id, opts) { ... }
```

Important distinction:

- The helper may write `SleepState`.
- The helper should read sleep through the facade when answering semantic
  questions.
- Transition functions may inspect `SleepState` because they manage the backing
  record.

This gives systems readable calls while still preserving the status facade as
the semantic source.

## Canonical Transitions

### Put to sleep
All sleep application paths should route through:

```js
putActorToSleep(world, actorId, {
  reason,
  wakeDifficulty,
  wakeRadius,
  wakeOnDamage,
  source,
})
```

Responsibilities:

- Validate actor id and liveness.
- Create or update `SleepState`.
- Set `asleep: true`.
- Emit `sleep:slept` only on awake -> asleep transition unless explicitly
  suppressed for spawn-time initialization.
- Preserve deterministic behavior. No timers, promises, or `Math.random()`.

Known call sites:

- Authored monster sleep during spawn.
- Sleep schedules.
- Future spell/item/potion/wand effects.

### Wake
All wake paths should route through:

```js
tryWakeActor(world, actorId, {
  reason,
  intensity,
  source,
})
```

Responsibilities:

- Return false if the actor is not asleep.
- Respect `wakeDifficulty` for non-damage disturbances.
- Respect `wakeOnDamage`.
- Set `SleepState.asleep = false` on success.
- Emit `sleep:woke` on successful asleep -> awake transition.

Known wake triggers:

- Damage.
- Schedule wake.
- Future noise/light/interaction triggers.

## Consumer Semantics
Sleeping should block more than movement.

### Action
Sleep prevents active voluntary actions:

- move
- fly/takeoff/land
- attack
- ranged attack
- cast/channel
- search
- interact
- item use
- posture changes

`intentValidationSystem` should remove all action intents from sleeping actors.
Individual intent consumers that can receive intents after validation must also
guard themselves. Validation is a convenience, not the only safety net.

### Movement
`movementSystem` must reject sleepers directly. This prevents a `MoveIntent`
created after validation from moving the actor.

`flyIntentSystem` must reject sleepers directly. Flight is an action and a
movement mode, so it is covered by the same rule.

### Perception and AI
Sleeping actors do not perform active perception.

AI systems should not let sleepers:

- acquire LOS aggro
- update last-known player position
- witness stealth offenses
- alert pack allies through sight
- run on-seen or while-LOS hooks
- produce new chase/flee/flight intents

Damage-based aggro can still occur after wake processing. If listener order
matters, tests should lock the desired behavior.

### Channeling
Channel interruption policy should treat `sleep` as a hard interrupt through the
status facade or sleep helper. It should not locally check `"sleep"` and
`"asleep"` string aliases.

Preferred shape:

```js
{
  reason: "asleep",
  when: (world, actorId) => sleepPreventsAction(world, actorId),
}
```

The helper then resolves through `statusStrength(world, actorId, "sleep")`.

### WorldView
WorldView should project the `"sleeping"` display tag from status semantics, not
from direct display-side component interpretation.

Bridge may import rules components/utilities, but display must not. The display
layer should only consume tags such as `"sleeping"` from the bridge DTO.

Recommended:

- Bridge asks `hasStatus(world, id, "sleep")` or `isAsleep(world, id)`.
- Bridge emits entity tag `"sleeping"` for presentation.
- Display maps `"sleeping"` to emoji/VFX/glyph treatment.

## Status Key Policy

Use:

```js
statusStrength(world, id, "sleep")
hasStatus(world, id, "sleep")
```

Avoid:

```js
statusStrength(world, id, "asleep")
statusStrength(world, id, "sleep") || statusStrength(world, id, "asleep")
world.get(id, SleepState)?.asleep // outside sleep/status internals
```

Compatibility aliases can be added inside the facade only if old content
requires them. Do not duplicate alias logic at call sites.

## Component Ownership

### `SleepState`
Owns:

- asleep/awake backing flag
- wake difficulty
- wake radius
- wake-on-damage behavior
- future sleep depth or disturbance counters, if needed

Does not own:

- generic status duration ticking
- display tags
- AI policy decisions
- item/spell authoring data

### `Status` / `ActiveEffects` / topology effect nodes
May produce sleep through the facade if a future effect applies sleep as a timed
condition. They do not replace `SleepState` when wake difficulty or sleep
biology matters.

Future timed sleep spell direction:

- Effect application calls `putActorToSleep`.
- If duration is needed, store duration in the effect topology and have the
  effect expiration call `tryWakeActor` or clear the sleep source.
- Do not create a second independent sleep countdown that bypasses sleep
  transitions.

## Event Contract

Events are semantic rules events:

- `sleep:slept`
  - `{ actor, reason, source? }`
- `sleep:woke`
  - `{ actor, reason, intensity?, source? }`

Events should be emitted by transition helpers, not by individual systems after
manual component mutation.

Spawn-time sleep may suppress `sleep:slept` if the actor enters the world already
asleep and no presentation/audio cue is desired.

## Test Plan

Required focused tests:

1. Status facade projects `SleepState.asleep` as `sleep`.
2. `isAsleep` reads through the facade and returns true for `SleepState`.
3. `putActorToSleep` emits `sleep:slept` on transition and not on no-op.
4. `tryWakeActor` respects wake difficulty and emits `sleep:woke`.
5. Damage wakes actors through the canonical listener.
6. `intentValidationSystem` strips all action intents from sleepers.
7. `movementSystem` rejects sleepers even if `MoveIntent` bypasses validation.
8. `flyIntentSystem` rejects sleepers even if `FlyIntent` bypasses validation.
9. `aiChaseSystem` does not let sleepers see, aggro, or queue chase movement.
10. Stealth offense witnesses exclude sleepers.
11. Pack alerting does not alert sleeping allies by sight.
12. Channel interruption returns `"asleep"` for `SleepState` via helper/facade.
13. WorldView projects `"sleeping"` from facade semantics.
14. Authored sleep spawn uses the same transition data as scheduled sleep.

Regression tests should prefer invariant behavior over snapshots. For example:

- "sleeping actor position is unchanged after movement consumer"
- "sleeping enemy remains unaware after visible-player AI tick"
- "visible sleeping lichen carries `sleeping` tag in WorldView"

## Implementation Sequence

### Phase 1: Facade integration
- Add `SleepState` projection to `statusFacade`.
- Add or update tests for `statusStrength(world, id, "sleep")`.
- Make `isAsleep` read through `statusStrength`.

### Phase 2: Canonical transitions
- Add `putActorToSleep`.
- Update spawn and schedule code to call it.
- Keep `tryWakeActor` as the only wake mutation path.
- Add event/no-op transition tests.

### Phase 3: Consumer gates
- Update intent validation to use `sleepPreventsAction`.
- Add direct guards in movement and flight intent consumers.
- Update channel interruption to use sleep helper only.
- Update AI perception/witness/pack alert paths to use sleep helper.

### Phase 4: Bridge projection
- Project `"sleeping"` through `hasStatus("sleep")` or `isAsleep`.
- Confirm display receives the tag for visible sleepers.

### Phase 5: Content follow-up
- Only after the mechanics pass is green, add a simple sleep-causing item/spell
  if desired.
- Do not use that item as the first test of the mechanism.

## Open Questions

1. Should timed magical sleep share the same `SleepState`, or should it create a
   child effect node that owns duration and calls sleep transitions?
2. Should damage always wake, or should very deep sleep allow damage without
   waking for specific monster profiles?
3. Should sleeping actors retain previous aggro state for after waking, or decay
   awareness while asleep?
4. Should sleepers block passive perception only, or also passive reactions such
   as thorns/auras?
5. Should a sleeper's facing update when bumped or damaged, or remain frozen?
6. What is the exact player-sleep UX? This is intentionally deferred.

## Guardrails

- No system-to-system calls.
- No direct `SleepState` checks outside sleep/status/bridge internals without a
  strong reason.
- No duplicated `"sleep"`/`"asleep"` alias checks at call sites.
- No display imports from rules.
- No item/wand/potion work until the facade and consumer tests are green.
- No sleeping-player UX until explicitly designed.

