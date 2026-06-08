# World Resource Candidates

This note tracks future targets for replacing ad hoc `world[Symbol.for(...)]`
state with explicit `ecs-js` resources where the state is genuinely
world-local runtime infrastructure.

Resources should stay rare. Use a component, including a singleton component,
when the state is a durable simulation fact. Use a resource when the value is a
runtime queue, cache, schedule, listener buffer, handle, or other world-local
mechanic that should be named, resettable, diagnosable, and kept out of random
properties on `world`.

## Converted Anchors

- `TrapStepQueueResource`: runtime movement-arrival queue captured by the trap
  step listener and drained by `trapSystem`.
- `MaterialReactionEventQueueResource`: runtime semantic event queue captured by
  material reaction listeners and drained by `materialReactionSystem`.

## Strong Next Candidates

- `DeathImpactResource`: `cleanupSystem` records temporary death-impact context
  for cleanup-time effects. This looks like a short-lived queue/map used to
  bridge event-time information into a scheduled cleanup pass.
- `PlantGrowthScheduleResource`: standalone plant growth uses a turn schedule
  and tracked wakeup state. The schedule itself looks resource-shaped because it
  is runtime scheduling infrastructure, not an entity fact.
- `ItemCooldownScheduleResource` and `SpellCooldownScheduleResource`: the turn
  schedules are runtime indexing structures. The actual cooldown facts may
  still deserve components or existing domain maps; split the schedule from the
  durable cooldown state before converting.
- `QuestEventRoutesResource`: quest runtime event routes are listener dispatch
  infrastructure. Audit persistence expectations before converting, because
  quest progress itself must remain component/domain state.

## Needs Design Before Conversion

- Deity, prayer, and shrine state: several values are gameplay memory or
  progression facts. They should not become resources by default.
- Dialogue sessions: these may be durable interaction state depending on save
  semantics. Treat as a singleton component candidate until proven runtime-only.
- AI cooldowns, gaze exposure, ability windup, and combat callback maps: some
  may be tactical runtime caches, but some affect fairness across turns and
  saves. Classify each one by persistence semantics first.
- Debug toggles such as god mode, noclip, and FOV cone disablement: these may be
  host/debug resources, but they should not be mixed with rules simulation
  state without an explicit debug-state policy.

## Conversion Rules

- Do not create a resource just to hide a smell. First prove that the value is
  world-local runtime infrastructure rather than gameplay state.
- Prefer one cohesive resource for tightly coupled runtime state, such as a
  queue plus its local sequence counter.
- Do not rebuild a registry around resources. Use the `ecs-js` resource
  registry through `defineWorldResource(...)` and `world.resource(...)`.
- When converting listener-owned state, migrate the touched listener to
  `defineExtension(...)` and install it with `world.install(...)`.
