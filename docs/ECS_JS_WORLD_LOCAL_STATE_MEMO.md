# Technical Memo: World-Local State in ecs-js

Status: Proposal memo

This memo records an architectural gap in `ecs-js`: the engine has no canonical
primitive for named world-local runtime state. That absence has encouraged
callers to attach ad hoc state directly to `World` instances with symbol keys:

```js
const KEY = Symbol.for("some:feature:state");
world[KEY] = new Map();
```

That pattern is not a harmless convenience. It is an architectural escape hatch
without a contract. It turns `World` from the owner of ECS state into a general
mutable bag, and it makes hidden state indistinguishable from engine state.

The requirement is to make this entire class of behavior explicit in `ecs-js`,
then prohibit direct `world[...]` state outside the library.

## Need

JSHack has accumulated many world-attached symbol stores. They usually exist for
one of these reasons:

- Installer idempotence flags.
- Runtime queues used by event listeners.
- Per-world cooldown maps.
- Per-world caches or virtual handles.
- Debug toggles.
- Feature-local state machines.

Some of these are legitimate world-local concerns. The problem is not that a
world sometimes needs state outside a particular entity. The problem is that the
current expression of that need is unowned.

`ecs-js` already gives strong vocabulary for most simulation concepts:

- Components are durable facts attached to entities.
- Tags are marker facts attached to entities.
- Queries expose component facts in a structured way.
- Events route synchronous notifications.
- Extensions install runtime behavior once.
- Virtuals expose computed component-like projections.

But there is no canonical answer for:

> This feature needs a named, world-local runtime value that is not naturally a
> component on a particular entity, not just an extension installer flag, and
> not a computed virtual.

Because that concept is missing, callers invented it with raw symbol properties.

## Why Direct `world[...]` Is Wrong

Direct world-attached state bypasses the ECS model.

It is not queryable. It is not discoverable through ordinary debug inspection.
It is not governed by component lifecycle. It is not clearly included or
excluded from serialization. It has no naming registry. It has no ownership
declaration. It has no cleanup convention. It gives every module permission to
mutate the shape of `World`.

Symbols avoid accidental JavaScript property-name collisions, but they do not
solve architectural collision. Two modules can still invent overlapping
concepts, hide state from each other, or depend on implicit initialization
order. The result is a simulation object with undocumented side channels.

The smell is especially sharp in deterministic simulation code. If state changes
matter to the simulation, the state should have a model. If the state does not
matter to the simulation, it should be scoped outside rules or treated as a
host/display concern. Raw `world[...]` does neither.

## Current Coverage in ecs-js

`defineExtension(...)` is close, but incomplete.

Extensions solve idempotent installation:

```js
export const featureListeners = defineExtension("feature", (world) => {
  world.on(EventClass, listener);
});

world.install(featureListeners);
```

That answers: "Has this behavior been installed once?"

It does not answer:

- Where does this installed behavior keep its queue?
- Where does a world-local cache live?
- How is the value named for inspection?
- Is the value runtime-only or serializable?
- Who owns cleanup?
- How does code retrieve it without knowing a private property key?

Components also cover part of the space. For durable simulation state, a
singleton entity plus component is often the correct answer:

```js
const id = world.singleton(DungeonState);
world.get(id, DungeonState);
```

That is the right shape when the state is part of the simulated world and should
be inspectable, serializable, and governed like other ECS facts.

But not every world-local value should be an entity. Runtime-only helper state,
extension queues, virtual handles, memoization structures, or host integration
objects may be engine-adjacent rather than simulation facts. Those still need a
contract.

## Requirement

`ecs-js` should expose a first-class world-local state facility.

The facility must:

- Be owned by `ecs-js`, not caller-created object properties.
- Require an explicit name or key.
- Be discoverable for debug/diagnostic purposes.
- Make runtime-only versus serializable intent explicit.
- Support lazy initialization.
- Support cleanup/reset where appropriate.
- Compose with `defineExtension(...)`.
- Be deterministic by default when used in rules simulation.
- Leave components as the preferred representation for durable simulation facts.
- Allow guards to ban direct `world[...]` outside `src/lib/ecs-js`.

The facility should not become a new dumping ground. Its contract should make
misuse visible.

## Proposed Shape

The core primitive should be a named world-local slot owned by `World`.

Conceptually:

```js
const FeatureQueue = defineWorldResource("feature.queue", {
  create: () => [],
  reset: (queue) => {
    queue.length = 0;
  },
  serializable: false,
});

const queue = world.resource(FeatureQueue);
queue.push(event);
```

The exact API can change, but the required semantics are:

1. The resource definition is a stable object exported by a module.
2. `World` stores resource values in an internal map, not on arbitrary instance
   properties.
3. Access is explicit: `world.resource(def)` or equivalent.
4. Lazy initialization is controlled by the definition.
5. Diagnostics can list installed/created resources.
6. Serialization policy is explicit and conservative.
7. Cleanup/reset is part of the resource definition, not a caller convention.

An extension should be able to declare and use resources:

```js
export const trapStepQueue = defineWorldResource("trap.stepQueue", {
  create: () => [],
  reset: (queue) => {
    queue.length = 0;
  },
});

export const trapStepListeners = defineExtension(
  "trap.stepListeners",
  (world) => {
    world.on(Moved, (event) => {
      world.resource(trapStepQueue).push(event);
    });
  },
);
```

This keeps installation and state separate but compatible:

- `defineExtension` owns "install this behavior once."
- `defineWorldResource` owns "this world has this named local value."

## Singleton Components Still Matter

The new primitive must not replace singleton components.

Use singleton ECS components when the state is simulation state:

- Dungeon state.
- Calendar state.
- Weather state.
- Deity authorship budgets.
- Player challenge cadence, if it belongs to the player.
- Global simulation facts that should survive save/load.

Use world-local resources when the state is runtime infrastructure:

- Event queues that exist only to bridge listener timing.
- Caches that can be recomputed.
- Virtual handles.
- Extension-private data.
- Debug or host integration state.

If a state value changes gameplay and should be saved, queried, or inspected as
a fact of the world, it should usually be a component. If a state value supports
runtime mechanics but is not itself a world fact, it may be a resource.

## Naming Options

At least three canonical names are viable:

1. `WorldResource`
   - Strongest fit if the concept is "a named resource owned by the world."
   - Familiar to ECS users from other engines.
   - Risk: "resource" can be confused with game resources such as mana, ore, or
     crops in application code.

2. `WorldLocal`
   - Emphasizes scope: local to a particular `World`.
   - Avoids overloaded game-content meaning.
   - Reads well in APIs: `defineWorldLocal(...)`, `world.local(...)`.

3. `WorldSlot`
   - Emphasizes a named storage slot, not an entity or component.
   - Compact and hard to confuse with gameplay resources.
   - Slightly less familiar than "resource."

Other plausible names:

- `WorldService`: good for host APIs and adapters, less good for simple data.
- `WorldRegistry`: good for maps of things, too broad for a single value.
- `RuntimeResource`: clear about non-serialization, but too narrow if the API
  also supports serializable values.
- `WorldStore`: accurate, but risks confusion with component stores.

Recommendation: use `WorldResource` if `ecs-js` wants to align with common ECS
language. Use `WorldLocal` if avoiding game-resource ambiguity matters more.

## API Sketch

One possible concrete API:

```js
export function defineWorldResource(name, options = {}) {
  return Object.freeze({
    key: options.key ?? Symbol(name),
    name,
    create: options.create ?? (() => undefined),
    reset: options.reset ?? null,
    dispose: options.dispose ?? null,
    serialize: options.serialize ?? null,
    deserialize: options.deserialize ?? null,
    serializable: options.serializable === true,
  });
}
```

World methods:

```js
world.resource(def); // get or lazily create
world.hasResource(def); // boolean
world.setResource(def, value); // explicit replacement
world.resetResource(def); // call def.reset or recreate
world.deleteResource(def); // call dispose, then remove
world.resources(); // diagnostics
```

Open questions:

- Should resource values be mutable by default, or should definitions encourage
  `world.mutateResource(def, fn)`?
- Should serializable resources be allowed at all, or should serializable
  world-level state always be singleton components?
- Should resources be available in strict mode during ticks?
- Should `defineExtension` accept a `resources` list for diagnostics?

The conservative answer is:

- Mutable values are acceptable for runtime-only infrastructure.
- Serializable resources should be rare; prefer singleton components.
- Strict mode should not forbid access, but guards should forbid raw
  `world[...]`.
- Extensions may optionally declare resources, but access should not require
  installation.

## Guardrail Consequence

Once `ecs-js` has the primitive, application guardrails can become simple:

```text
Outside src/lib/ecs-js, no direct world[...] or ctx.world[...] state.
Use components, singleton components, defineExtension, or world resources.
```

This is stronger than a historical allowlist. It does not bless old mistakes. It
defines the sanctioned channel and makes every bypass visible.

The transition path can be:

1. Add the `ecs-js` primitive.
2. Add tests in `ecs-js` for creation, lookup, reset, deletion, diagnostics, and
   extension coexistence.
3. Update the JSHack architecture guard to forbid direct world-attached state
   outside `src/lib/ecs-js`.
4. Migrate existing offenders by category:
   - Installer flags -> `defineExtension`.
   - Durable simulation state -> singleton components.
   - Runtime queues/caches -> world resources.
   - Debug toggles -> host/display state or world resources, depending scope.
5. Delete the historical ratchet allowlist.

## Motivation

The goal is not purity for its own sake. The goal is to preserve the usefulness
of `World` as the trustworthy simulation boundary.

When a developer or agent sees `world.get`, `world.query`, `world.emit`, or
`world.install`, the behavior has a contract. When it sees `world[KEY]`, the
contract has to be rediscovered from local code. That does not scale.

Fast implementation without a named primitive created a class of hidden state
that now has to be paid down. The right response is not another local convention
or another larger allowlist. The right response is for `ecs-js` to own the
escape hatch, name it, constrain it, and make it inspectable.

That gives JSHack a clean rule, and it gives `ecs-js` a missing primitive it
should have had before large simulations started leaning on it.
