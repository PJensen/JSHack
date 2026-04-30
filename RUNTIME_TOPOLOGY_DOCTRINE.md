# Runtime Topology Doctrine

Runtime multiplicity is modeled as attached child entities.

Components describe facts. Hierarchy describes topology. Resolvers derive views.
Systems execute behavior through events.

This doctrine makes explicit a pattern JSHack already uses in inventory and proc
topology: when runtime things multiply, attach entities instead of hiding active
objects inside arrays on one component.

For the incremental migration backlog, see
[RUNTIME_TOPOLOGY_WORK_ITEMS.md](RUNTIME_TOPOLOGY_WORK_ITEMS.md).

## Canonical Rule

If a runtime thing has identity, lifecycle, ownership, source, duration, charges,
removability, targeting, behavior hooks, query relevance, debug relevance, or
save/load significance, it should usually be represented as its own entity.

The preferred shape is:

```txt
parent entity
  attached runtime node
    behavior node
    state component
    source component
```

The discouraged runtime shape is:

```js
ActiveEffects: {
  effects: []
}
```

or:

```js
Sockets: {
  slots: []
}
```

or:

```js
Enchantments: {
  active: []
}
```

Those structures hide active runtime objects inside private containers. They make
the objects harder to query, inspect, remove, serialize, target, and extend.

## Invariant

One entity may have zero or one component of a given type.

Multiplicity is represented by many entities, not many same-type components on
one entity. Components remain flat state records. Definitions may be nested.
Runtime state should be ECS-visible.

## Rule of Thumb

Arrays are acceptable for static authoring data and small private value lists.

Arrays are suspicious when they contain active runtime things.

If another system needs to find it, remove it, target it, tick it, save it,
inspect it, or react to it, it probably deserves to be an entity.

## Definitions vs Runtime

Authoring data may stay nested when it describes static defaults, catalogs,
weights, proc packages, or imported definitions.

Runtime identity belongs in entities.

Use this split:

```txt
Definitions
  static authoring data

Entities
  runtime identity

Components
  flat facts

Hierarchy
  runtime topology

Resolvers
  derived views

Systems
  behavior

Events
  decoupling
```

## Reference Shape: Inventory

Inventory is the reference implementation for this doctrine.

```txt
owner entity
  InventoryRoot entity
    item entity
    item entity
    item entity
```

Inventory items are real entities. Containment is expressed through hierarchy.
Read/write access is mediated through the inventory facade instead of every
system inventing its own traversal.

New topology-backed systems should follow that pattern:

- Create explicit child entities for runtime objects.
- Put flat facts on those entities as components.
- Expose canonical helpers or facades for common operations.
- Keep compatibility views behind resolvers while migration is underway.

## Reference Shape: Proc Topology

Proc behavior should remain visible to ECS traversal:

```txt
item or status node
  AffixTopologyNode / EnchantmentNode / SocketNode / StatusEffectNode
    ProcNode
      ActivationGate
      ProcEffect
      DerivedExpression
```

Attached behavior nodes make procs inspectable and composable. Avoid rebuilding
runtime behavior from opaque arrays once a runtime node can own it.

## Legacy Array Ratchet

Some systems still use array-backed runtime state, especially status effects,
equipment slots, affixes, enchantments, and socket state. Do not rewrite all of
them at once.

Use this ratchet:

- New systems must follow runtime topology.
- Touched systems should migrate toward runtime topology.
- Legacy array-backed systems are allowed temporarily.
- Legacy arrays must be treated as compatibility state, not precedent.
- Resolvers and facades should isolate legacy structures.
- When a runtime node exists, make it the source of truth and derive old views
  from it only where compatibility requires that.

## Migration Targets

Best candidates for incremental migration:

1. Enchantments
2. Gem sockets and socketed state
3. Active effects
4. Equipment slots
5. ItemInfo affixes

The preferred status shape is:

```txt
actor
  StatusEffectNode
    Duration
    Source
    StatModifier
    DerivedExpression
    ProcNode
```

The preferred equipment shape is:

```txt
actor
  EquipmentRoot
    EquippedSlotNode(slot: "main_hand")
      item
```

`Equipment` may remain as a derived/cache component for quick lookups during
migration, but it should not remain the canonical topology forever.

The preferred socket shape is:

```txt
weapon
  SocketNode(id: "blade")
    SocketedItemNode(defId: "gem.fluorite")
      Charges
      ProcNode
```

Charges should live on the runtime thing that owns the charges. Shrine,
recharge, removal, inspection, save/load, and UI logic should find socketed
children with `Charges`; they should not rummage through item info arrays.

The preferred enchantment shape is:

```txt
item
  EnchantmentNode(defId: "ench.firebrand", level: 2)
    Source(kind: "scroll", id: "scroll.firebrand")
    Charges
    ProcNode(trigger: "on_hit")
      ActivationGate
      ProcEffect
```

Scrolls, shrines, curses, oils, gems, and temporary buffs should create or
modify runtime child entities rather than mutating an affix array as the final
runtime state.

## Traversal Helpers

Do not let every system crawl topology differently.

Prefer small canonical helpers and facades:

```js
function* childrenWith(world, parent, Component) {
  for (const child of world.children(parent)) {
    if (world.has(child, Component)) {
      yield [child, world.get(child, Component)];
    }
  }
}

function firstChildWith(world, parent, Component) {
  for (const [child, component] of childrenWith(world, parent, Component)) {
    return [child, component];
  }

  return null;
}

function* descendantsWith(world, parent, Component) {
  for (const child of world.children(parent)) {
    if (world.has(child, Component)) {
      yield [child, world.get(child, Component)];
    }

    yield* descendantsWith(world, child, Component);
  }
}
```

Then define domain facades and resolvers such as:

```txt
inventoryFacade
resolveEquipmentView
resolveStatusView
resolveProcGraph
resolveSocketView
resolveWeaponProfile
```

Topology should be visible, but traversal should be standardized.

## CANNON Interaction

Runtime topology and CANNON are the same pressure applied at different scales.

For each domain operation, define one canonical implementation path. Alternate
entry points such as debug commands, scripts, transactions, dungeon
materialization, and spawners must delegate to it or stay parity-tested.

For topology-backed domains, the canonical path should create the runtime child
entities and attach their components. Compatibility components may mirror the
result, but they must not become a second source of truth.
