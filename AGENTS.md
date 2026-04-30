# Agents & JSHack

JSHack is a hackable, zero-dependency, browser-based roguelike engine built with pure JavaScript and Entity-Component-System (ECS) architecture. This document provides autonomous agents, copilots, and automated operators with the context needed to understand, maintain, and extend the codebase without fighting the architecture or violating its core principles.

Think of this as the field manual for working with JSHack. For API details and conceptual deep dives, see [README.md](README.md). For architectural boundaries, see [SEPARATION_MANIFEST.md](SEPARATION_MANIFEST.md). For project philosophy and constraints, see [TEN_COMMANDMENTS.md](TEN_COMMANDMENTS.md). For runtime multiplicity and entity hierarchy rules, see [RUNTIME_TOPOLOGY_DOCTRINE.md](RUNTIME_TOPOLOGY_DOCTRINE.md). When you need to keep the project humming without derailing it, stay here.

---

## Principles for agents

### Why JSHack works for agents

- **Zero build step**: Pure ES modules. Edit a file, refresh the browser. No webpack, no babel, no transpilation. Perfect for iterative agent-driven development. **We will NEVER add a build step.**
- **Deterministic core**: Seeded RNG (`0xC0FFEE`, `0xa77a77`) means every run is reproducible. Given the same seed and input sequence, the simulation produces identical results.
- **Strict separation**: Three-layer architecture (`rules/` → `bridge/` → `display/`) with enforced boundaries. **Church (visuals) and State (rules) are separated** per [SEPARATION_MANIFEST.md](SEPARATION_MANIFEST.md). Rules are pure logic, display is pure presentation, bridge is the contract.
- **ECS architecture**: Built on [ecs-js](src/lib/ecs-js/), which has its own [AGENTS.md](src/lib/ecs-js/AGENTS.md). **Read and know the ecs-js AGENTS.md**. Composable systems, reusable components, archetype-based spawning. **ECS-js is an external library (vendored as a module)** - changes here must truly be bugs in the architecture, not feature additions.
- **One file = one idea**: Modular design where each file has a single, clear purpose. Easy to locate, read, and modify.
- **Mobile-first roguelike**: **Touch is primary, phone is the default platform.** Desktop keyboard is secondary. All UX decisions prioritize touch/mobile experience.
- **Hackable by design**: No frameworks, no magic. Just plain JavaScript that you can `console.log` and step through. **We are absolutely HACKING and having fun exploiting JavaScript.**
- **Deno for tooling**: We use **Deno**, not Node. Testing, scripts, and utilities run on Deno.

### Critical constraints (read this twice)

JSHack has burned twice (Oct 23 and Nov 6, 2025) by violating these constraints. The [TEN_COMMANDMENTS.md](TEN_COMMANDMENTS.md) exists because the same mistakes were made repeatedly. **Agents must internalize these rules**:

**Meta-constraints (never violate these):**

0. **Know and use ecs-js**: Read [ecs-js/AGENTS.md](src/lib/ecs-js/AGENTS.md) before touching any ECS code. ECS-js is an external library vendored as a module. **Only modify ecs-js if you find a genuine architecture bug.** Do not add features to ecs-js; add them to JSHack's rules layer instead.
0.1. **No system-to-system calls**: Systems never call other systems directly. Use events (`world.emit` / `world.on`) for inter-system communication. When installing event listeners, **use a Symbol to track installation status** and check it before re-installing. Symbol names must be clear and domain-specific (e.g., `Symbol.for('jshack:affixTriggers:installed')`).
0.2. **Mobile-first always**: We are building a **mobile-first roguelike**. Touch is primary, phones are the target device. Desktop keyboard is a secondary convenience. Every UX decision must work on mobile first.
0.3. **Separation is law**: Read [SEPARATION_MANIFEST.md](SEPARATION_MANIFEST.md). Church (visuals in `display/`) and State (logic in `rules/`) are absolutely separated. Never mix them.
0.4. **Hacking is the point**: We are **absolutely HACKING and having fun exploiting JavaScript**. Clever tricks are encouraged. Over-engineering is not. Push the language, don't fight it.
0.5. **No build step, ever**: Pure ES modules, no transpilation, no bundling. This is non-negotiable.
0.6. **Deno, not Node**: All tooling, testing, and scripts use Deno. If you write a test or utility script, it runs on Deno.
0.7. **CANNON, not release valves**: For each domain operation, there must be one canonical implementation path. Every alternate entry point must delegate to it and stay parity-tested.
0.8. **Runtime topology is attached entities**: Runtime multiplicity belongs in parent/child entity topology, not hidden arrays on one component. Components describe flat facts; hierarchy describes containment and attachment; resolvers derive views. Read [RUNTIME_TOPOLOGY_DOCTRINE.md](RUNTIME_TOPOLOGY_DOCTRINE.md) before adding systems that create effects, enchantments, sockets, equipment slots, procs, or other repeatable runtime objects.

**Game-specific constraints (keep the roguelike pure):**

1. **This is a roguelike, not a rendering engine**: Integer grid, cardinal/diagonal movement, boolean FOV. No continuous space, no SDF kernels, no analytic geometry. If you're writing `Math.hypot` for collision, stop.
2. **No lighting engine**: FOV is a boolean visibility mask (visible/remembered/unknown). Simple shadowcasting only. No raycasting, no shadow volumes, no emissive polygons.
3. **Integer positions**: `Position.x` and `Position.y` are integers. Movement deltas are -1, 0, or 1. No `BoundingCircle`, no `strideDistance`.
4. **Gameplay before graphics**: Every feature must answer "what does the player do differently?" Visual polish waits until systems work.
5. **Tests before systems**: If a system has no test, it doesn't exist. The successful rebuild was test-driven; the failures had zero tests.
6. **Commit message canary**: Single-letter commits ("a", "a", "a") mean you're solving the wrong problem. Stop, stash, walk away.
7. **One system per session**: Wire it, test it, commit it with a real message. No 500+ line commits across 25 files.
8. **Rules layer purity**: `src/rules/` never imports from `src/display/` or references rendering concepts. If it needs a "geometry kernel," the architecture is wrong.
9. **Solve visible problems**: The player sees a grid. Solve grid problems. Sub-tile collision and continuous-space pathfinding are solutions looking for problems.
10. **Remember the history**: 564 lines of lighting deleted after one evening. 921-line GeometryKernel reintroduced two days after clean rebuild. **If you're excited about the math, that's the warning sign.**

---

## ECS-js: External library (read this carefully)

**CRITICAL**: ECS-js is an **external library** vendored as a module in `src/lib/ecs-js/`. It is **NOT** part of JSHack's codebase.

### Rules for touching ECS-js

1. **Read [ecs-js/AGENTS.md](src/lib/ecs-js/AGENTS.md) first** - understand the architecture before making any changes
2. **Only modify for genuine bugs** - if the ECS architecture itself is broken, fix it
3. **Never add features to ECS-js** - feature additions belong in JSHack's rules layer
4. **Consult before changing** - ECS-js changes affect the entire architecture

### When NOT to touch ECS-js

- ❌ "I need a new component type" → Add it in `src/rules/components/`
- ❌ "I need a new system feature" → Add it in `src/rules/systems/`
- ❌ "I want to extend World" → Use composition or helpers in `src/rules/utils/`
- ❌ "I need custom queries" → Write query helpers in `src/rules/utils/queries.js`

### When you MIGHT touch ECS-js

- ✅ `world.query()` returns wrong results (genuine bug)
- ✅ `world.rng()` is not deterministic (genuine bug)
- ✅ Scheduler doesn't execute phases in declared order (genuine bug)
- ✅ Component storage is broken (genuine bug)

**Default assumption**: The problem is in JSHack code, not ECS-js. Only touch ECS-js when you're certain it's an architecture bug.

### Action transaction boundary (do not build a second ECS)

JSHack has a rules-layer action-local transaction utility in `src/rules/interaction/mutations.js`.
It exists only to support all-or-nothing resolution inside one action callback chain (cancel vs commit).

Rules:
- It is **not** a scheduler.
- It is **not** a replacement for ECS-js `world.command(...)`.
- It must **not** become a cross-system queue.
- In rules code, only `src/rules/utils/actionContexts.js` may import it directly.
- If you need multi-system ordering, use intent components + scheduler phases (`intents`, `effects`, `cleanup`), not transaction ops.

### Canonical pathways (CANNON)

As the codebase grows, avoid one-off "release valves" that bypass canonical construction/mutation logic.

Rules:
- For any repeated operation (spawn monster, spawn item, cast spell, apply status), define exactly one canonical implementation.
- All alternate call sites (debug commands, scripts, transactions, dungeon materialization, spawners) must delegate to the canonical path.
- If an alternate call site cannot delegate, it must reproduce the full canonical payload and have a parity regression test.
- Never ship ad-hoc bootstrap patches as permanent behavior when canonical-path parity can be fixed at the source.

Required parity pattern:
- Add/maintain a parity test that compares outcomes across all spawn vectors for the same entity family.
- Example for monsters: debug mutation spawn, dungeon materialize spawn, and spawner child spawn must produce equivalent gameplay-relevant components (identity, brain/spells, mana, resistances, speed, creature type, hooks behavior).
- Treat parity drift as a blocker, not a cleanup task.

### Runtime topology doctrine

Runtime multiplicity is modeled as attached child entities.

JSHack already uses this pattern for inventory:

```txt
owner entity
  InventoryRoot entity
    item entity
    item entity
    item entity
```

Use the same doctrine for new repeatable runtime objects such as enchantments,
gem sockets, socketed items, status effects, timed effects, equipment slots,
charges, sources, and proc graphs.

Rules:
- Components describe flat facts.
- Hierarchy describes topology.
- Resolvers derive compatibility views and UI-ready summaries.
- Systems execute behavior through events.
- Arrays are acceptable for static authoring data and small private values.
- Arrays are suspicious when they contain active runtime things.

If another system needs to find it, remove it, target it, tick it, save it,
inspect it, or react to it, it probably deserves to be an entity.

Legacy array-backed components such as `ActiveEffects.effects[]`, slot records,
socket arrays, or `ItemInfo.affixes[]` may remain temporarily as compatibility
state, but they are not precedent for new runtime topology. Touched systems
should migrate toward child entities behind canonical facades and resolvers.

See [RUNTIME_TOPOLOGY_DOCTRINE.md](RUNTIME_TOPOLOGY_DOCTRINE.md) for migration
targets and traversal helper guidance.

---

## System communication: Events, not calls

**RULE**: Systems never call other systems directly. Use events for all inter-system communication.

### Why no direct calls?

Direct system calls break the ECS scheduler's control flow and make execution order unpredictable. The scheduler manages when systems run; systems should only:
1. Query entities
2. Modify components
3. Emit events
4. Listen to events

### Composability over one-off wiring

When adding emergent gameplay interactions (materials, status interactions, item reactions, etc.):

- Prefer one composable system with a small reaction table over many micro-systems.
- Key reactions off semantic state (`Status`, `ActiveEffects`, tags, data), not off a single spell/script ID.
- Add new reactions as data entries in the table; avoid hardcoding source-specific branches.
- Define trigger conditions as data (e.g., `sourceStatuses`) instead of hardcoded `if` helpers per status.
- For item reactions, handle both containment scopes explicitly: items on the ground and items in inventories/equipment.
- Do not keep legacy/back-compat shims in rules code unless explicitly requested for migration.

This keeps mechanics scalable as content grows (many statuses, many materials) without exploding system count.

### Event-based communication pattern

```js
// ❌ WRONG: Direct system call
function systemA(world, dt) {
  // ...
  systemB(world, dt); // BAD! Breaks scheduler control
}

// ✅ CORRECT: Event-based communication
function systemA(world, dt) {
  // ...
  world.emit('something:happened', { id, data });
}

function systemB(world, dt) {
  // Listens to 'something:happened' via installed listener
}
```

### Installing event listeners with Symbols

**CRITICAL**: Always use a Symbol to track installation status. This prevents duplicate listener registration when worlds are re-initialized.

```js
// Define a unique Symbol (use clear, domain-specific names)
const INSTALLED_KEY = Symbol.for('jshack:affixTriggers:installed');

export function installAffixTriggers(world) {
  // Check if already installed
  if (world[INSTALLED_KEY]) return;

  // Mark as installed
  world[INSTALLED_KEY] = true;

  // Install listeners
  world.on('combat:beforeHit', (ctx) => {
    // Handle event
  });

  world.on('combat:hit', (ctx) => {
    // Handle event
  });
}
```

### Symbol naming convention

Format: `Symbol.for('jshack:<domain>:<what>:installed')`

Examples from JSHack:
- `Symbol.for('jshack:affixTriggers:installed')` - Affix system event listeners
- `Symbol.for('jshack:engraveScramble:installed')` - Engraving step listener
- `Symbol.for('jshack:bumpInteract:installed')` - Bump-to-interact listener

**The domain should be clear and germane.** Anyone reading the Symbol should immediately understand what subsystem it belongs to.

### Where to call install functions

Install functions are typically called once in `configureWorld()` in [scheduler.js](src/main/scheduler.js):

```js
export function configureWorld(world) {
  clearSystems();

  // Install event listeners once per world
  installAffixTriggers(world);
  installEngraveListeners(world);
  installBumpInteractListener(world);

  // Register systems...
  registerSystem(aiChaseSystem, 'intents');
  // ...
}
```

---

## Project structure & navigation

### Top-level layout

```
/src/
  rules/          — Pure deterministic simulation (systems, components, archetypes, scripts, data)
  bridge/         — Neutral contract (WorldView schema, event readers, FOV)
  display/        — Rendering, VFX, camera, lighting, input, UI
  main/           — Composition root (scheduler, input dispatch, lifecycle)
  shared/         — Pure utilities (math, grid algorithms)
  lib/            — ecs-js core and deity-js (embedded libraries)
/reference/       — Demos and implementation references
/tests/           — Test suite (currently sparse; must expand)
index.html        — Entry point (no build step; open directly or serve statically)
```

### Import boundaries (who can import whom)

- **rules/** may import: `shared/`, `lib/ecs-js/`
  - **MUST NOT** import: `bridge/`, `display/`, `main/`, DOM, timers, rAF
- **bridge/** may import: `rules/` (read-only), `shared/`
  - **MUST NOT** import: `display/`, `main/`
- **display/** may import: `bridge/`, `shared/`
  - **MUST NOT** import: `rules/`
- **main/** wires everything; owns lifecycle; no game logic

If in doubt: `rules → bridge → display`. **Never the reverse.**

### Key subsystems map

#### Rules layer (`src/rules/`)

The deterministic simulation core. All game logic lives here.

- **systems/** (26 systems, ~2300 LOC)
  - Organized in 3 phases: `intents`, `effects`, `cleanup`
  - **intents**: AI, movement, combat, item use, spells, interactions
  - **effects**: Equipment, status effects, hunger, mana regen, spawners, deity mood
  - **cleanup**: Entity removal, spatial index sync
  - See [scheduler.js](src/main/scheduler.js) for full registration order

- **components/** (30+ components)
  - Core: `Position`, `NamedIdentity`, `Collider`, `Terrain`
  - Combat: `Vitality`, `CombatStats`, `Damage`, `Faction`, `Facing`
  - Actor: `Player`, `Brain`, `Inventory`, `Equipment`, `Mana`, `Hunger`
  - Status: `ActiveEffects`, `Status`, `Physiology`, `Anatomy`
  - Items: `ItemInfo`, `Consumable`, `Material`, `Owner`, `Pet`
  - World: `DungeonState`, `Dungeon`, `MonsterSpawner`, `Engraving`
  - Intents: `MoveIntent`, `AttackIntent`, `WaitIntent`, etc.
  - Meta: `ScriptRef` (connects entities to scripting system)

- **archetypes/** (12 archetype files)
  - Entity templates using `defineArchetype` from ecs-js
  - `Player`, `Creatures` (kobold, goblin, orc, troll, etc.)
  - `Items` (potions, scrolls, weapons, armor, wands, currency)
  - `Tiles` (floor, wall, shallow water, deep water)
  - `Door`, `Stairs` (up/down), `Chest`, `Sign`, `Traps`, `Spawner`, `Food`

- **scripts/** (4 script modules)
  - `consumables.js`: Potion/scroll use handlers
  - `monsters.js`: Monster-specific AI behaviors
  - `spells.js`: Spell cast logic (fireball, lightning, heal, etc.)
  - `traps.js`: Trap trigger effects
  - Scripts use `ScriptVerb` enum and `runScript()` from `scripting.js`

- **data/** (12 data files)
  - `spells.js`: Spell definitions (name, cost, range, damage)
  - `monsters.js`: Monster stats and spawn weights
  - `items.js`: Item prefabs and generation rules
  - `equipment.js`: Weapon/armor base stats
  - `affixes.js`: Magic item affixes (AFFIX_DEFS)
  - `deities.js`: Deity definitions and favor mechanics
  - `food.js`: Food types and nutrition values
  - `lootTables.js` + `lootResolver.js`: Loot generation system
  - `shopStock.js`: Shop inventory generation
  - `validate.js`: Data validation utilities

- **environment/**
  - Dungeon generation, tile maps, FOV, explored map

- **utils/**
  - Queries, spatial indexing, vision calculations

#### Bridge layer (`src/bridge/`)

The stable contract between rules and display. **Never add rendering logic here.**

- **schema/**
  - `worldView.js`: Builds `WorldView` DTO (turn, seed, player, entities, solids, emissives, FOV)
  - `mapView.js`: Tile grid view (optional secondary view)

WorldView shape:
```js
{
  turn: number,
  seed: number,
  player: { id: number, pos: { x: number, y: number } } | null,
  entities: Array<{ id, kind, pos: {x, y}, tags: [] }>,
  solids: Array<{ id, x, y }>,
  emissives: Array<{ id, x, y, kind }>,
  engravings: Array<{ id, text, pos: {x, y} }>,
  tileGrid: { getTile, forEachTileInRect },
  isVisible: (x, y) => boolean,
  isExplored: (x, y) => boolean
}
```

Events (emitted from rules, consumed by display):
- `moved { id, from: {x, y}, to: {x, y} }`
- `damage { id, amount, at: {x, y} }`
- `died { id, at: {x, y} }`
- `spawned { id, at: {x, y}, kind }`

#### Display layer (`src/display/`)

Pure presentation. **Never import from rules/ directly.**

- **camera/**: Controller, shake, zoom, ease, follow
- **passes/**: Rendering pipeline (glyphs, VFX, particles, float text)
- **lighting/**: Light field computation (uses WorldView.emissives)
- **palette/**: Kind/tag → glyph/color mapping
- **input/**: Keyboard, touch, gesture routing
- **ui/**: HUD, status line, inventory, message log, overlays

#### Main layer (`src/main/`)

Wiring and lifecycle. No game logic.

- `scheduler.js`: Registers all systems into phases, builds world scheduler
- `input/rulesDispatch.js`: Converts input events into intents

---

## Daily maintenance workflow

### Boot a deterministic playground

```js
import { World } from './src/lib/ecs-js/index.js';
import { configureWorld } from './src/main/scheduler.js';

const world = new World({ seed: 0xC0FFEE }); // or 0xa77a77
configureWorld(world);

// Tick manually for deterministic testing
world.tick(1);
```

Phases are declared in `scheduler.js`: `intents`, `effects`, `cleanup`. All systems are explicitly registered with `registerSystem(fn, phase)`.

### Step-and-explain workflow

1. Create world with fixed seed
2. Spawn entities (player, monsters, items)
3. Add intents to entities (MoveIntent, AttackIntent, etc.)
4. Tick once: `world.tick(1)`
5. Inspect results: `world.query(Component1, Component2)`
6. Verify events emitted (check event listeners)
7. Repeat

Because ticks are synchronous and deterministic, agents can pause between steps, regenerate code, and resume without state drift.

### Adding a new system

1. **Create the system**: `src/rules/systems/mySystem.js`
   ```js
   export function mySystem(world, dt) {
     for (const [id, comp1, comp2] of world.query(Comp1, Comp2)) {
       // System logic here
     }
   }
   ```

2. **Register in scheduler**: `src/main/scheduler.js`
   ```js
   import { mySystem } from '../rules/systems/mySystem.js';
   // ...
   registerSystem(mySystem, 'intents'); // or 'effects' or 'cleanup'
   ```

3. **Write a test**: `tests/mySystem.test.js`
   ```js
   import { World } from '../src/lib/ecs-js/index.js';
   import { mySystem } from '../src/rules/systems/mySystem.js';

   const world = new World({ seed: 42 });
   const id = world.create();
   world.set(id, Comp1, { value: 10 });
   mySystem(world, 1);
   // Assert expected behavior
   ```

4. **Commit with clear message**: "add mySystem for X behavior"

### Adding a new component

1. **Create the component**: `src/rules/components/MyComponent.js`
   ```js
   export const MyComponent = Object.freeze({
     value: 0,
     enabled: true,
   });
   ```

2. **Export from index**: `src/rules/components/index.js`
   ```js
   export { MyComponent } from './MyComponent.js';
   ```

3. **Use in systems/archetypes**: Import and use in queries or archetype definitions

### Adding a new archetype

1. **Create the archetype**: `src/rules/archetypes/MyEntity.js`
   ```js
   import { defineArchetype } from '../../lib/ecs-js/archetype.js';
   import { Position } from '../components/Position.js';
   import { NamedIdentity } from '../components/NamedIdentity.js';

   export const MyEntity = defineArchetype('MyEntity',
     [Position, p => ({ x: p.x, y: p.y })],
     [NamedIdentity, { name: 'My Entity', identity: 'my_entity' }],
   );
   ```

2. **Export from index**: `src/rules/archetypes/index.js`

3. **Spawn entities**: `createFrom(world, MyEntity, { x: 10, y: 10 })`

### Adding a script

1. **Register script handler**: `src/rules/scripts/myScripts.js`
   ```js
   import { registerScript, ScriptVerb } from '../scripting.js';

   registerScript('my_script_key', {
     [ScriptVerb.ItemUse]: (world, ctx) => {
       const { entityId, userId, params } = ctx;
       // Script logic here
     }
   });
   ```

2. **Import in scheduler**: `src/main/scheduler.js`
   ```js
   import '../rules/scripts/myScripts.js'; // Side-effect import
   ```

3. **Attach to entity**: Add `ScriptRef` component
   ```js
   world.set(id, ScriptRef, { ref: 'my_script_key', params: { ... } });
   ```

4. **Trigger from system**:
   ```js
   runEntityScript(world, entityId, ScriptVerb.ItemUse, { userId });
   ```

### Modifying display logic

**NEVER touch rules/ when adding visual features.** Display logic lives exclusively in `src/display/`.

1. **Identify the pass**: Glyphs? VFX? UI? Lighting?
2. **Modify the pass**: Edit files in `display/passes/` or `display/ui/`
3. **Use WorldView only**: Access data via `buildWorldView(world)`
4. **Test visually**: Refresh browser, no rebuild needed

Example: Adding a new particle effect
```js
// In display/passes/vfx/particles/particlePool.js
ParticleFX.spawn({
  x, y,
  vx, vy,
  life: 1.0,
  color: '#ff0000',
  // ...
});
```

### Debugging determinism

If behavior becomes non-deterministic:

1. **Check RNG usage**: All randomness must use `world.rng()`, not `Math.random()`
2. **Check system ordering**: Systems must not depend on query iteration order
3. **Check async code**: Rules layer must have zero async code (no timers, no promises)
4. **Check floating point**: Prefer integers; if using floats, be aware of precision issues
5. **Replay with same seed**: Create world with same seed, apply same inputs, verify same results

---

## Common tasks & patterns

### Spawning entities

```js
import { createFrom } from './lib/ecs-js/archetype.js';
import { Goblin } from './rules/archetypes/Creatures.js';

const goblinId = createFrom(world, Goblin, { x: 10, y: 10 });
```

### Querying entities

```js
import { Position, Vitality } from './rules/components/index.js';

for (const [id, pos, vit] of world.query(Position, Vitality)) {
  if (vit.hp <= 0) {
    console.log(`Entity ${id} is dead at (${pos.x}, ${pos.y})`);
  }
}
```

### Adding intents

```js
import { MoveIntent } from './rules/components/Intents/MoveIntent.js';

world.set(entityId, MoveIntent, { dx: 1, dy: 0 });
world.tick(1); // movementSystem consumes the intent
```

### Listening to events

**CRITICAL**: Systems must never call other systems directly. Use events for inter-system communication.

**Always use a Symbol to track installation status:**

```js
// In a system or setup function
const INSTALLED_KEY = Symbol.for('jshack:damageLogger:installed');

export function installDamageLogger(world) {
  if (world[INSTALLED_KEY]) return; // Already installed
  world[INSTALLED_KEY] = true;

  world.on('damage', ({ id, amount, at }) => {
    console.log(`Entity ${id} took ${amount} damage at (${at.x}, ${at.y})`);
  });
}
```

Symbol naming convention: `jshack:<domain>:<what>:installed`

Examples:
- `Symbol.for('jshack:affixTriggers:installed')`
- `Symbol.for('jshack:engraveScramble:installed')`
- `Symbol.for('jshack:bumpInteract:installed')`

This prevents duplicate listener registration when systems are re-initialized.

### Applying status effects

```js
import { ensureActiveEffects } from './rules/utils/effects.js';

const effects = ensureActiveEffects(world, entityId);
effects.effects.push({
  key: 'poison',
  turnsLeft: 3,
  potency: 2,
});
```

`ActiveEffects.effects[]` is legacy compatibility state. Use existing helpers
when working with it, and prefer `StatusEffectNode` / `TimedEffectNode` child
entities for new status-effect topology.

### Modifying equipment stats

```js
import { CombatStats } from './rules/components/CombatStats.js';

const stats = world.get(entityId, CombatStats);
stats.attackBonus += 5;
stats.armorClass += 2;
world.set(entityId, CombatStats, stats);
```

### Spatial queries

```js
import { forEachInRadius } from './rules/utils/spatialIndex.js';

forEachInRadius(world, x, y, radius, (nearId) => {
  console.log(`Found entity ${nearId} near (${x}, ${y})`);
});
```

---

## Testing & verification

### Writing tests

Tests are **mandatory** for new systems. Store in `tests/` directory.

```js
import { World } from '../src/lib/ecs-js/index.js';
import { mySystem } from '../src/rules/systems/mySystem.js';
import { MyComponent } from '../src/rules/components/MyComponent.js';

// Deterministic seed
const world = new World({ seed: 0xDEADBEEF });

// Setup
const id = world.create();
world.set(id, MyComponent, { value: 10 });

// Execute
mySystem(world, 1);

// Assert
const result = world.get(id, MyComponent);
if (result.value !== 11) {
  throw new Error(`Expected value 11, got ${result.value}`);
}

console.log('✓ mySystem test passed');
```

### Running tests

```bash
# Browser tests (open in browser)
open tests/index.html

# Deno tests (we use Deno, not Node)
deno test --allow-read tests/mySystem.test.js
deno run tests/mySystem.test.js
```

### Regression prevention

When fixing a bug:

1. Write a failing test that reproduces the bug
2. Fix the bug in the system
3. Verify the test passes
4. Commit test and fix together

This creates a permanent guard against regression.

---

## ⚠️ Agentic test gravity wells (read before fixing red tests)

Tests are not purely protective in an agentic loop.

When a test fails, an agent does **not** automatically understand the product intent behind recent feature changes. It only sees a red suite and a reward signal for green. That creates a dangerous failure mode:

- The agent can "fix" failures by restoring old behavior.
- The suite goes green.
- The project silently moves backward.

In plain English: an agent can unmake the future to satisfy the past.

### Why this matters in JSHack

JSHack evolves quickly. Content, schedules, spawn rules, and interaction contracts move often. Old tests can become stale while still looking authoritative. If an agent treats stale tests as ground truth, it may:

- Revert intentional gameplay changes.
- Reintroduce older constants/positions just to satisfy brittle assertions.
- Strip new pathways because they are not represented in legacy tests.

### Non-negotiable policy

When test failures appear after feature work:

1. **Treat intent as source of truth, not prior assertions.**
2. **Do not revert feature semantics without explicit human instruction.**
3. **Update tests to current intended behavior when intent changed.**
4. **Only then fix code defects relative to that updated intent.**

### Required red-suite triage workflow (agents must follow)

1. **Classify each failure**
  - A) stale test expectation
  - B) real implementation bug
  - C) ambiguous (needs human decision)

2. **State intended behavior first**
  - Write 1-2 sentences describing what should happen now.
  - If unclear, ask before editing runtime logic.

3. **Prefer invariant tests over snapshot tests**
  - Good: reachability, bounded counts, canonical-path parity, determinism, layer boundaries.
  - Weak: decorative exact coordinates, tautologies (`>= 0`), trivial existence-only checks with no behavioral consequence.

4. **Protect newness explicitly**
  - Add/update tests that encode the new feature contract.
  - Remove or rewrite tests that enforce superseded behavior.

5. **Audit for backwards fixes before concluding**
  - If a change made tests green by narrowing capability, rolling back data, or removing pathways, stop and flag it.

### PR/commit review trigger words

If a commit message or diff indicates "fix failing tests," reviewers must check for semantic regression, not just pass/fail:

- Did runtime change to old constants/positions/weights solely to satisfy tests?
- Were assertions weakened instead of clarified?
- Were new feature pathways removed without product decision?

Green is not success unless intent is preserved.

### Fast rule for future agents

Use this exact heuristic:

> "When tests fail after feature changes, do not drag runtime behavior backward to satisfy legacy tests. First align tests with intended behavior, then fix true defects against that intent."

---

## Performance & profiling

### Rules profiling

Enable rules profiling via URL param or localStorage:

```
?rulesProfile=1
localStorage.setItem('jshack.rulesProfile', '1')
```

Profiler output available at `window.__JSHACK_RULES_PROF.lastTick`:

```js
{
  totalMs: 2.4,
  phases: {
    intents: { totalMs: 1.2, systems: [{ name: 'movementSystem', ms: 0.5 }, ...] },
    effects: { totalMs: 0.8, systems: [...] },
    cleanup: { totalMs: 0.4, systems: [...] }
  }
}
```

### Quality controls

Mobile-first quality settings (URL params or localStorage):

```
?quality=low|auto|high
?dprCap=<number>
?cameraLerp=<number>
```

- **low**: Disables glow, halves particles, caps DPR to 1
- **auto**: Balanced (default)
- **high**: Full quality

These operate entirely in display/ and do not affect determinism.

### Performance hotspots

Common bottlenecks:

1. **Spatial queries**: Use spatial index, not full entity scans
2. **FOV recalculation**: Already cached per turn in `worldView.js`
3. **Particle count**: Controlled by `PERF.particleCapacity`
4. **DPR scaling**: Mobile devices default to 1.5x cap
5. **Glow layers**: Disabled on low quality

**Do not optimize prematurely.** Profile first, optimize hotspots second.

---

## Event system & bridge events

### Emitting events (from rules)

```js
// In a system
world.emit('damage', {
  id: targetId,
  amount: damageDealt,
  at: { x: pos.x, y: pos.y }
});
```

### Consuming events (in display)

```js
// In main.js or display setup
world.on('damage', ({ id, amount, at }) => {
  FloatText.spawn({
    text: `-${amount}`,
    x: at.x,
    y: at.y,
    color: '#ff0000',
  });
});
```

### Standard event types

- `moved`: Entity moved from one tile to another
- `damage`: Entity took damage
- `died`: Entity died (before removal)
- `spawned`: New entity created
- `pickup`: Item picked up
- `drop`: Item dropped
- `spell:cast`: Spell cast by entity
- Custom events: Use consistent naming conventions

---

## Scripting system deep dive

JSHack uses a `ScriptRef` component to attach behavior to entities without hardcoding logic into systems.

### Script verbs (event types)

```js
ScriptVerb = {
  SpellCast: "spell:cast",
  AffixOnBeforeHit: "affix:onBeforeHit",
  AffixOnHit: "affix:onHit",
  AffixOnDamaged: "affix:onDamaged",
  AffixPassive: "affix:passive",
  ItemOnEquip: "item:onEquip",
  ItemOnUnequip: "item:onUnequip",
  ItemUse: "item:use",
  TrapTrigger: "trap:trigger",
}
```

### Registering a script handler

```js
import { registerScript, ScriptVerb } from '../scripting.js';

registerScript('fireball_spell', {
  [ScriptVerb.SpellCast]: (world, ctx) => {
    const { entityId, targetX, targetY, params } = ctx;
    const damage = params.damage || 10;
    const radius = params.radius || 2;

    // Apply fireball damage in radius
    forEachInRadius(world, targetX, targetY, radius, (id) => {
      const vit = world.get(id, Vitality);
      if (vit) {
        vit.hp -= damage;
        world.set(id, Vitality, vit);
        world.emit('damage', { id, amount: damage, at: { x: targetX, y: targetY } });
      }
    });
  }
});
```

### Attaching scripts to entities

```js
import { ScriptRef } from './rules/components/ScriptRef.js';

world.set(spellId, ScriptRef, {
  ref: 'fireball_spell',
  params: { damage: 15, radius: 3 }
});
```

### Triggering scripts

```js
import { runEntityScript, ScriptVerb } from './rules/scripting.js';

runEntityScript(world, spellId, ScriptVerb.SpellCast, {
  entityId: casterId,
  targetX: 10,
  targetY: 5,
});
```

---

## Deity system

JSHack includes a deity/favor system for roguelike religious mechanics.

### Initialization

```js
import { initDeity } from './rules/systems/deitySystem.js';

initDeity(world, playerId, deityKey); // e.g., 'nyx', 'bahamut'
```

### Favor mechanics

Favor changes based on player actions. The `deitySystem` ticks each turn and processes favor decay/events.

### Deity data

Defined in `src/rules/data/deities.js`. Each deity has:
- Name, description
- Likes/dislikes (actions that gain/lose favor)
- Boons (rewards for high favor)
- Wrath (penalties for low favor)

---

## Dungeon generation & environment

### Tile system

Tiles are integers stored in a 2D grid. Tile IDs are defined in `src/rules/environment/dungeon/tileMap.js`.

Common tiles:
- 0: Floor
- 1: Wall
- 2: Shallow water
- 3: Deep water
- etc.

Access via:
```js
import { getTile, setTile } from './rules/environment/dungeon/tileMap.js';

const tileId = getTile(x, y);
```

### FOV & exploration

FOV is computed once per turn and cached. Uses shadowcasting algorithm.

```js
import { isVisible, isExplored } from './rules/environment/dungeon/exploredMap.js';

if (isVisible(x, y)) {
  // Tile is currently visible
}

if (isExplored(x, y)) {
  // Tile has been seen before (remembered)
}
```

---

## Camera & display controls

### Camera API

```js
import { zoomTo, jumpTo, easeTo } from './display/camera/utils.js';
import { startShake } from './display/camera/shake.js';

zoomTo(camera, 2.0, 0.3); // Zoom to 2x over 0.3 seconds
jumpTo(camera, x, y);     // Instant snap to position
easeTo(camera, x, y, 0.5); // Ease to position over 0.5 seconds
startShake(shakeState, 10); // Shake intensity 10
```

### Following entities

```js
import { followEntity } from './display/camera/follow.js';

followEntity(camera, entityId, world);
```

Camera automatically tracks the entity each frame.

---

## Mobile & touch input

### Mobile-first philosophy

**We are building a mobile-first roguelike.** Touch is the primary input method. Phones are the target platform. Desktop keyboard support is secondary.

**Every feature must answer**: "How does this work on a phone with touch input?"

### Gesture support

- **Single tap**: Move toward tapped side (cardinal direction)
- **Double tap**: Pick up items underfoot
- **Pinch**: Zoom in/out
- **Swipe right**: Open inventory
- **Swipe down**: Open message log

All UI elements must be **finger-sized** (44px minimum touch target). No hover states (touch has no hover). All interactions must work with fat fingers.

### Input lockdown

Prevents browser default behaviors (scroll, zoom, context menu):

```js
import { enableInputLockdown } from './display/input/lockdown.js';

enableInputLockdown({ canvas });
```

This is essential for mobile - without it, the browser intercepts gestures for zooming and scrolling.

---

## Data files & content authoring

### Adding a new spell

Edit `src/rules/data/spells.js`:

```js
export const SPELLS = {
  my_spell: {
    name: 'My Spell',
    cost: 10,
    range: 5,
    damage: 15,
    description: 'A custom spell effect',
  },
};
```

Add script handler in `src/rules/scripts/spells.js`:

```js
registerScript('spell:my_spell', {
  [ScriptVerb.SpellCast]: (world, ctx) => {
    // Spell logic
  }
});
```

### Adding a new monster

Edit `src/rules/data/monsters.js`:

```js
export const MONSTERS = {
  my_monster: {
    name: 'My Monster',
    hp: 20,
    damage: [2, 6],
    xp: 50,
    // ...
  },
};
```

Create archetype in `src/rules/archetypes/Creatures.js` or new file.

### Adding a new item

Edit `src/rules/data/items.js`:

```js
export const ITEMS = {
  my_item: {
    name: 'My Item',
    kind: 'potion',
    rarity: 'rare',
    // ...
  },
};
```

Add to loot tables in `src/rules/data/lootTables.js` if needed.

---

## Git & commit hygiene

### Good commit messages

✅ "add trapSystem for pressure plate triggers"
✅ "fix movementSystem collider check off-by-one"
✅ "refactor itemPickupSystem to use spatial index"

❌ "a"
❌ "fix"
❌ "wip"

**Single-letter commits are a canary.** They indicate flow state on the wrong problem. Stop, stash, reassess.

### Commit size

One system per session. If a commit touches more than 5 files or adds 500+ lines, you're likely over-scoped.

Break it down:
1. Add component (commit)
2. Add system (commit)
3. Wire system to scheduler (commit)
4. Add test (commit)

Small, tested, incremental.

### Branching

Main branch: `master`

For feature work:
```bash
git checkout -b feature/my-feature
# Work, commit, test
git checkout master
git merge feature/my-feature
```

No force-push to master. No amend on pushed commits.

---

## Common pitfalls & debugging

### World coordinates can be negative

**Symptom**: Hazards, spawns, or effects appear at (0, 0) instead of the correct position

**Cause**: Using `Math.max(0, value)` or `clampInt(value, fallback, min=0)` on world coordinates. World-space coordinates (Position.x, Position.y) **can be negative** — the dungeon extends in all directions from the origin. Clamping to min=0 silently destroys negative coordinates.

**Rule**: Never clamp x/y world coordinates to a minimum of 0. Validate that they are finite integers, but allow the full integer range. Use `Number.isFinite(v) ? (v | 0) : fallback` instead of `Math.max(0, v | 0)`.

### Rules layer importing from display

**Symptom**: `import ... from '../../display/...'` in rules/

**Fix**: Remove the import. This violates [SEPARATION_MANIFEST.md](SEPARATION_MANIFEST.md). **Church (display) and State (rules) are separated.** Use events or WorldView to communicate.

### System calling another system directly

**Symptom**: `someOtherSystem(world, dt)` called from within a system

**Fix**: Use events instead. Systems communicate via `world.emit` and `world.on`. Install listeners once using a Symbol to track installation:

```js
const INSTALLED = Symbol.for('jshack:myListener:installed');
if (!world[INSTALLED]) {
  world[INSTALLED] = true;
  world.on('myEvent', handler);
}
```

**Never** call systems directly. The scheduler manages system execution order.

### Non-deterministic behavior

**Symptom**: Same seed produces different results

**Debugging**:
1. Check for `Math.random()` instead of `world.rng()`
2. Check for system ordering dependencies
3. Check for floating point precision issues
4. Check for uninitialized component fields

### FOV not updating

**Symptom**: Tiles remain unexplored despite player movement

**Debugging**:
1. Verify `updateFOV` is called each turn in `worldView.js`
2. Check `Brain.visionRange` on player entity
3. Verify `blocksVisionMap` includes walls/doors correctly

### Entity not moving

**Symptom**: Entity has MoveIntent but doesn't move

**Debugging**:
1. Check if `movementSystem` is registered in scheduler
2. Verify Collider/Position components exist
3. Check for blocking terrain or entities
4. Verify intent is consumed (not left on entity after tick)

### Script not firing

**Symptom**: Script handler registered but never executes

**Debugging**:
1. Verify script module is imported in `scheduler.js`
2. Check `ScriptRef` is attached to entity
3. Verify correct `ScriptVerb` is used
4. Check for typos in script key (`registerScript` vs `ScriptRef.ref`)

### Spawn parity drift (canonical path violation)

**Symptom**: A monster behaves differently depending on where it was spawned (debug spawn vs dungeon vs spawner vs script).

**Cause**: Multiple spawn paths constructing partial payloads (e.g., missing `learnedSpellIds`, `maxMana`, `manaRegen`, equipment) instead of delegating to the canonical spawn path.

**Fix**:
1. Route all spawn paths through canonical constructors/utilities.
2. Ensure each route carries full monster definition payload.
3. Add/update parity tests to enforce component equivalence across spawn vectors.

---

## Maintenance rituals

### Before merging

- [ ] Read [ecs-js/AGENTS.md](src/lib/ecs-js/AGENTS.md) if touching ECS code
- [ ] No modifications to ecs-js (unless genuine architecture bug)
- [ ] No system-to-system calls (use events with Symbol tracking)
- [ ] No imports from `rules/` inside `display/`
- [ ] No DOM/window/rAF references in `rules/`
- [ ] Canonical-path parity preserved (no one-off spawn/cast/apply bypasses)
- [ ] Alternate entry points delegate to canonical utilities or have parity tests
- [ ] Red-suite triage completed: stale tests updated to current intent; no runtime rollback made only to satisfy legacy assertions
- [ ] Works on mobile with touch (test on phone or DevTools mobile sim)
- [ ] All new systems have tests (Deno tests, not Node)
- [ ] Commit messages are descriptive
- [ ] No single-letter commits
- [ ] No 500+ line commits
- [ ] No build step added
- [ ] Run `./build.ps1` (error check)
- [ ] Test in browser (open `index.html`)
- [ ] Test on mobile device (not just desktop)

### Weekly sanity checks

1. Run full test suite
2. Load a game and play for 5 minutes
3. Check for console errors
4. Verify determinism (same seed, same inputs → same outcome)
5. Profile rules (check for runaway system costs)

### When stuck

1. Read the constraints ([TEN_COMMANDMENTS.md](TEN_COMMANDMENTS.md))
2. Check separation boundaries ([SEPARATION_MANIFEST.md](SEPARATION_MANIFEST.md))
3. Ask: "Is this a gameplay feature or an engine feature?"
4. If engine, consider whether it's actually needed
5. If uncertain, walk away and return fresh

---

## Resources & references

### Required reading (read these first)

- **[ecs-js AGENTS.md](src/lib/ecs-js/AGENTS.md)**: ECS-specific agent guidance. **Know this before touching any ECS code.**
- **[TEN_COMMANDMENTS.md](TEN_COMMANDMENTS.md)**: Project philosophy and constraints. The project burned twice ignoring these.
- **[SEPARATION_MANIFEST.md](SEPARATION_MANIFEST.md)**: Layer boundaries and import rules. Church vs State separation.

### Reference documentation

- [README.md](README.md): Usage, controls, architecture overview
- [ecs-js README](src/lib/ecs-js/README.md): ECS core API
- [deity-js README](src/lib/deity-js/README.md): Deity system API

### External references

- [Roguelike Development Guide](http://www.roguebasin.com/)
- [ECS Architecture Patterns](https://en.wikipedia.org/wiki/Entity_component_system)
- [Shadowcasting FOV](http://www.roguebasin.com/index.php?title=FOV_using_recursive_shadowcasting)

---

## Final reminders for agents

### Non-negotiable rules

1. **Read ecs-js/AGENTS.md first.** Know the ECS architecture before touching any code. ECS-js is external; only fix real bugs, never add features there.
2. **No system-to-system calls.** Use events (`world.emit`/`world.on`) with Symbol-based installation tracking.
3. **Mobile-first always.** Touch is primary. Phones are the target. Every feature must work on mobile.
4. **Separation is law.** Church (display) and State (rules) never mix. Read SEPARATION_MANIFEST.md.
5. **Hacking is encouraged.** We're exploiting JavaScript and having fun. Clever tricks welcome.
6. **No build step, ever.** Pure ES modules. This is non-negotiable.
7. **Deno, not Node.** All tooling and testing uses Deno.
8. **Do exactly what is asked.** Do not add content beyond the mechanism requested. If asked to build a pipeline, build the pipeline and one proof-of-concept. Stop. Do not invent items, affixes, catalog entries, loot table wiring, or fix unrelated "inconsistencies" unless explicitly asked. When the mechanism is done, ask what content the user wants on top of it.

### Roguelike-specific rules

8. **This is a roguelike, not a rendering engine.** Stay focused on gameplay systems.
9. **Determinism is sacred.** Seeded RNG, no async in rules, reproducible results.
10. **Test before systems.** If it has no test, it doesn't exist.
11. **One system per session.** Small, tested, incremental commits.
12. **Commit messages matter.** Single letters are a warning sign.
13. **Remember the history.** This project has burned twice. Learn from it.
14. **Red tests are not automatic truth.** Do not regress runtime behavior to satisfy stale tests; align tests to current intent first.

### Decision checklist

When in doubt, ask:
- **"Have I read ecs-js/AGENTS.md?"** (If no, read it first)
- **"Am I calling a system from another system?"** (If yes, use events instead)
- **"Does this work on mobile with touch?"** (If no, redesign)
- **"What does the player **do** differently?"** (If nothing, reconsider)
- **"Is this a grid problem or continuous-space problem?"** (JSHack is grid-only)
- **"Does this violate separation boundaries?"** (If yes, stop)
- **"Can I test this deterministically?"** (If no, refactor)
- **"Am I adding a build step?"** (If yes, absolutely not)
- **"Am I using Node?"** (If yes, use Deno instead)

If the answer doesn't align with these principles, **stop and reassess**.

---

Happy hacking!
