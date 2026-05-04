# AGENTS.md — JSHack Field Manual

JSHack is a hackable, zero-dependency, browser-based roguelike built with pure JavaScript and ECS architecture. This is the field manual for autonomous agents, copilots, and operators. It tells you the laws, the shape of the codebase, the patterns that work, and the traps that have already burned this project.

For deeper API dives see [README.md](README.md). For layer boundary rules see [SEPARATION_MANIFEST.md](docs/arch/SEPARATION_MANIFEST.md). For runtime entity topology see [RUNTIME_TOPOLOGY_DOCTRINE.md](docs/arch/RUNTIME_TOPOLOGY_DOCTRINE.md). For philosophy see [TEN_COMMANDMENTS.md](docs/arch/TEN_COMMANDMENTS.md). For the ECS library internals see [ecs-js/AGENTS.md](src/lib/ecs-js/AGENTS.md).

---

## Laws (read once, obey always)

**Meta-laws — never violate:**

- **No build step, ever.** Pure ES modules. No webpack, no babel, no bundling. Non-negotiable.
- **Deno, not Node.** All tests and tooling run on Deno. `deno test --allow-read`.
- **JavaScript only.** No TypeScript, no JSX, no transpilation targets.
- **Mobile-first.** Touch is primary. Phones are the target. Every feature must work on a phone with fat fingers. Desktop keyboard is secondary.
- **Separation is law.** `rules/` never imports from `display/` or `bridge/`. `display/` never imports from `rules/`. Bridge is read-only view of rules state. Violations break the entire architecture.
- **No system-to-system calls.** Systems communicate only via `world.emit` / `world.on`. Direct calls break scheduler control flow.
- **One canonical path.** For each repeated operation (spawn monster, cast spell, apply status), one canonical implementation. All call sites delegate to it. Alternate paths that can't delegate must reproduce the full payload and have a parity regression test.
- **Search before writing.** Before writing new code, search for existing code that does the same or similar thing. Extend it rather than duplicating it.
- **Do exactly what is asked.** Mechanism first, then stop. Do not invent content, wire loot tables, fix unrelated inconsistencies, or add "while I'm in here" changes. When the mechanism is done, ask.
- **ECS-js is external.** It lives in `src/lib/ecs-js/` and is a vendored library. Only modify it for genuine architecture bugs. New features belong in `src/rules/`.

**Roguelike-specific laws:**

- **Integer grid only.** `Position.x` and `Position.y` are integers. Movement deltas are -1, 0, or 1. No continuous space, no `Math.hypot` for collision, no bounding circles.
- **No lighting engine.** FOV is a boolean mask (visible / remembered / unknown). Shadowcasting only.
- **Gameplay before graphics.** Every feature must answer: "What does the player do differently?" Visual polish waits.
- **Determinism is sacred.** All randomness via `world.rand()`, never `Math.random()`. No async in rules layer (no timers, no promises, no fetch).
- **Tests before systems.** If a system has no test, it doesn't exist. New systems need Deno tests in `tests/`.
- **World coords can be negative.** Never clamp `x`/`y` to `>= 0`. The dungeon extends in all four directions. Use `Number.isFinite(v) ? (v | 0) : fallback`.
- **Runtime multiplicity = child entities.** Arrays are fine for static authoring data. Arrays of active runtime objects (effects, enchantments, sockets, procs) are wrong — use the child-entity topology from [RUNTIME_TOPOLOGY_DOCTRINE.md](docs/arch/RUNTIME_TOPOLOGY_DOCTRINE.md).

---

## Architecture

### Three-layer structure

```
rules/    Pure deterministic simulation. All game logic. No DOM, no timers, no imports from display/.
bridge/   Stable read-only contract. Builds WorldView DTO from rules state. No rendering logic.
display/  Pure presentation. Reads WorldView, main-provided read contracts, and world events. Never imports from rules/.
main/     Wiring and lifecycle. No game logic. Owns scheduler and input dispatch.
shared/   Pure math/grid utilities. No ECS, no DOM.
lib/      ecs-js (ECS core) and deity-js — vendored, treat as external.
```

State flows one way: `rules` state -> `bridge` DTO -> `display` rendering. ES module dependencies point inward: `display` may import `bridge`, `bridge` may import `rules`, and `rules` imports neither `bridge` nor `display`.

### Scheduler phases

Five phases, declared in [`src/main/scheduler.js`](src/main/scheduler.js):

| Phase | Purpose |
|-------|---------|
| `ai` | Intent producers — AI systems set MoveIntent, AttackIntent, etc. |
| `intents` | Intent consumers — movement, combat, item use, spells, interactions |
| `effects` | Per-turn derived effects — status ticks, hunger, weather, economy, spawners |
| `scripts` | Content DSL tick hooks (onTurnWhileCarried, etc.) |
| `cleanup` | Entity removal, lifespan, spatial index sync |

The system list is authoritative in `scheduler.js`. Don't rely on memory; read it. There are 60+ registered systems.

### Key rules subsystems

**`src/rules/systems/`** — all game logic, organized into phases above. Notable clusters:
- AI: `aiChaseSystem`, `aiScurrySystem`, `aiTownfolkSystem`, `aiFarmAnimalSystem`, `aiPolicySystem`, `aiWeaponPickupSystem`
- Combat: `combatSystem`, `rangedAttackSystem`, `castSpellSystem`, `channelingSystem`, `trapSystem`
- World: `weatherSystem`, `calendarSystem`, `townSimulationSystem`, `hydraulicsSystem`, `materialReactionSystem`, `plantGrowthSystem`
- Effects: `effectSystem`, `hungerSystem`, `manaRegenerationSystem`, `deitySystem`, `perceptionMemorySystem`

**`src/rules/components/`** — flat data definitions. Core ones:
- `Position`, `NamedIdentity`, `Collider`, `Terrain`, `Faction`, `Facing`
- `Vitality`, `CombatStats`, `Damage`, `ActiveEffects`, `Status`
- `Player`, `Brain`, `AggroState`, `Equipment`, `Inventory`, `Mana`, `Hunger`
- `DungeonState`, `WeatherState`, `TownfolkJob`, `GrowthStage`, `HarvestNode`
- Intent components: `MoveIntent`, `AttackIntent`, `WaitIntent`, `CastSpellIntent`, etc.

**`src/rules/data/`** — authoritative content definitions:
- `monsters.js`, `items.js`, `spells.js`, `equipment.js`, `affixes.js`
- `materials.js` — material optical/physical properties (gems, metals, etc.)
- `gems.js` — gem definitions keyed to material IDs
- `calendar.js` — `TURNS_PER_DAY`, `PHASE_BOUNDS`, moon phases
- `combatInteractions.js` — data-driven elemental/status interaction table
- `procPackages.js` — proc state definitions

**`src/rules/environment/`** — dungeon generation, tile maps, FOV, explored map, perception memory.

**`src/rules/utils/`** — query helpers, spatial index, vision, effects semantics, derived stats, passive bonuses, inventory virtuals.

**`src/rules/quests/`** and **`src/rules/dialogues/`** — quest runtime + NPC dialog trees.

### Overworld (depth 0)

Depth 0 is a full game area, not a menu. It has:
- 10 NPC townspeople with scheduled AI routines and an economy chain
- Weather system (clear/rain/heavy\_rain) with gameplay effects
- Calendar system (day/night cycle, moon phases, seasons)
- Plant growth (crops, flowers with stage identities)
- Building roofs with fire/burn/smolder states
- Quest givers, dialog trees, fishing spots, workstations
- Hydraulics rooms (portcullis gates, pressure plinths)

Systems gated to depth 0 check `ds.currentDepth === 0` or `ds.profileType === "overworld"`.

### WorldView contract

`buildWorldView(world)` in [`src/bridge/schema/worldView.js`](src/bridge/schema/worldView.js) returns a single reused `_view` object. Display reads this; it never calls into rules directly.

Key fields on `WorldView`:
```js
{
  turn, seed, currentDepth, isOverworld,
  player: { id, pos: {x, y} } | null,
  playerEntity: EntityView | null,
  entities: EntityView[],          // FOV-filtered, sorted by layer then y then x
  solids: SolidView[],
  emissives: any[],
  audioEmitters: AudioEmitterView[],
  roofs: RoofTileView[],           // overworld only
  fisheries: any[],
  engravings: EngravingView[],
  wetTiles: {x, y}[],
  tileGrid: { getTile, forEachTileInRect },
  isVisible: (x, y) => boolean,
  isExplored: (x, y) => boolean,
  weather: 'clear'|'rain'|'heavy_rain',
  playerSheltered: boolean,
  nightAlpha, dawnAlpha, duskAlpha, turnInDay, moonBrightness,
  playerVisionRadius, playerFacing, playerConeDegrees,
  perceptionState: { thermalSense, espSense, memoryTamper }
}
```

`EntityView` key fields: `id`, `kind`, `pos`, `tags[]`, `layer`, `hp`, `maxHp`, `isPet`, `showHealthBar`, `facing`, `weaponVfx`, `itemScale`, `visualOff`, `sizeClass`, `procStates`, `equipBadges`, `matOptical`.

Tags on entities are projected from: `Status.statuses`, `ActiveEffects.effects`, equipped items, monster defs, item affixes, material optical data, proc state. **Never push to `rec.tags` from display** — the bridge owns tag projection.

Gem optical data lives in `materials.js`. Gem definitions are in `gems.js`. Optical properties are bridged through `matOptical` on the EntityView. Display layer reads it; rules layer sets material intrinsics. This path goes through `worldView.js` — never duplicate material data into display.

---

## Patterns

### Event-based system communication

```js
// WRONG — breaks scheduler control
function systemA(world, dt) {
  systemB(world, dt);
}

// CORRECT — emit and listen
function systemA(world, dt) {
  world.emit('thing:happened', { id, data });
}
// systemB listens via installed listener (see below)
```

### Symbol-tracked listener installation

Always use a Symbol to prevent duplicate registration across world reinitializations.

```js
const INSTALLED = Symbol.for('jshack:myFeature:installed');

export function installMyListeners(world) {
  if (world[INSTALLED]) return;
  world[INSTALLED] = true;

  world.on('combat:hit', (ctx) => {
    // handle
  });
}
```

Symbol format: `Symbol.for('jshack:<domain>:<what>:installed')`

Install functions are called once in `configureWorld()` in `scheduler.js`.

### Adding a new system

1. Create `src/rules/systems/mySystem.js`
2. Import and `registerSystem(mySystem, 'effects')` in `scheduler.js` (pick the right phase)
3. Write a test: `tests/mySystem.test.mjs`
4. Run: `deno test --allow-read tests/mySystem.test.mjs`

```js
// mySystem.js
export function mySystem(world, dt) {
  for (const [id, comp] of world.query(MyComponent)) {
    // logic
  }
}

// test
import { World } from '../src/lib/ecs-js/index.js';
import { mySystem } from '../src/rules/systems/mySystem.js';

Deno.test('mySystem does X', () => {
  const world = new World({ seed: 42 });
  const id = world.create();
  world.set(id, MyComponent, { value: 10 });
  mySystem(world, 1);
  const result = world.get(id, MyComponent);
  if (result.value !== 11) throw new Error(`Expected 11, got ${result.value}`);
});
```

### Adding a new component

```js
// src/rules/components/MyComponent.js
export const MyComponent = Object.freeze({
  value: 0,
  enabled: true,
});
```

Export from `src/rules/components/index.js`.

### Composable reaction tables

When adding emergent gameplay interactions (material reactions, status interactions, elemental chains):
- One composable system with a data-driven reaction table beats many micro-systems.
- Key reactions off semantic state (tags, component data) not off specific spell/item IDs.
- New reactions = new data rows. No hardcoded `if (source === 'specific_thing')` branches.
- See `src/rules/data/combatInteractions.js` and `materialReactionSystem.js` for the pattern.

### Spatial queries

```js
import { forEachInRadius } from './rules/utils/spatialIndex.js';
forEachInRadius(world, x, y, radius, (nearId) => { /* ... */ });
```

Never do full `world.query()` scans for proximity — use the spatial index.

### Spawning entities

```js
import { createFrom } from './lib/ecs-js/archetype.js';
import { Goblin } from './rules/archetypes/Creatures.js';
const id = createFrom(world, Goblin, { x: 10, y: 10 });
```

All spawn paths (dungeon materialization, debug commands, spawner children) must route through canonical archetype constructors. Parity drift — a monster behaving differently based on spawn path — is a blocker.

### VFX in display

VFX = particle pool. Do not engineer new rendering classes. Use `ParticlePool` from `src/display/fx/`. Display wiring for new events lives in `src/display/ui/wiring/`. Display reads WorldView, main-provided read contracts, and world events; it never imports from rules.

---

## The test gravity well (read before touching red tests)

When a test fails, an agent sees a reward signal for making it green. That creates a dangerous failure mode: **the agent can make tests pass by restoring old behavior, silently moving the project backward.**

JSHack evolves fast. Tests go stale while still looking authoritative. If an agent treats stale tests as ground truth, it may revert intentional gameplay changes, reintroduce older constants, or strip new pathways.

**Non-negotiable policy:**

1. **Intent is source of truth, not prior assertions.** When tests fail after feature work, classify each failure: stale expectation vs. real bug vs. ambiguous.
2. **Do not revert feature semantics without explicit human instruction.**
3. **Update tests to current intended behavior first. Then fix real bugs against that intent.**
4. **Never "fix" a test by narrowing capability, removing pathways, or rolling back data.**
5. **Green is not success unless intent is preserved.**

Prefer invariant tests (reachability, bounded counts, canonical-path parity, determinism, layer boundaries) over snapshot tests (exact coordinates, existence-only checks, tautologies).

---

## Common pitfalls

**World coordinates can be negative.** Using `Math.max(0, value)` silently destroys negative coords. Validate with `Number.isFinite(v) ? (v | 0) : fallback`.

**`world.rand()` not `Math.random()`.** Any `Math.random()` call in rules layer breaks determinism.

**Duplicate listener registration.** Forgetting the Symbol guard causes listeners to stack across world reinitializations. Always check `world[INSTALLED]` before installing.

**Spawn parity drift.** A monster spawned via debug command missing components that the dungeon materializer adds. Route all spawn paths through the same canonical archetype + setup functions.

**Rules importing from display.** This violates separation and will cause circular imports or DOM access in rules. The import boundary is strict.

**System calling system.** `someOtherSystem(world, dt)` inside a system breaks phase ordering. Use `world.emit`.

**Async in rules.** No `setTimeout`, `Promise`, `fetch`, or `await` anywhere in `src/rules/`. Rules must be synchronous.

**ECS-js modification.** 99% of the time the problem is in JSHack code, not the ECS library. Default assumption: don't touch it.

**Material optical data duplicated in display.** Material properties (lightPass, lightReflect, dispersion, etc.) live in `src/rules/data/materials.js`. Gem lighting bridges through WorldView's `matOptical` field. Never add parallel material tables in display.

---

## Where to look for X

| What | Where |
|------|-------|
| All registered systems + phase order | [`src/main/scheduler.js`](src/main/scheduler.js) |
| WorldView shape + field semantics | [`src/bridge/schema/worldView.js`](src/bridge/schema/worldView.js) |
| Monster stats, AI fields, tags | [`src/rules/data/monsters.js`](src/rules/data/monsters.js) |
| Item definitions and loot | [`src/rules/data/items.js`](src/rules/data/items.js), `lootTables.js`, `lootResolver.js` |
| Spell definitions + script handlers | [`src/rules/data/spells.js`](src/rules/data/spells.js), [`src/rules/scripts/`](src/rules/scripts/) |
| Material optical/physical properties | [`src/rules/data/materials.js`](src/rules/data/materials.js) |
| Gem definitions | [`src/rules/data/gems.js`](src/rules/data/gems.js) |
| Elemental interaction table | [`src/rules/data/combatInteractions.js`](src/rules/data/combatInteractions.js) |
| Calendar constants (day length, phases) | [`src/rules/data/calendar.js`](src/rules/data/calendar.js) |
| Townspeople NPC definitions + economy | [`src/rules/data/townfolk.js`](src/rules/data/townfolk.js), `townEconomy.js` |
| Dungeon tile IDs and constants | [`src/rules/environment/dungeon/constants.js`](src/rules/environment/dungeon/constants.js) |
| FOV and explored map | [`src/rules/environment/dungeon/exploredMap.js`](src/rules/environment/dungeon/exploredMap.js) |
| Spatial index queries | [`src/rules/utils/spatialIndex.js`](src/rules/utils/spatialIndex.js) |
| Derived stats / passive bonuses | [`src/rules/utils/derivedStats.js`](src/rules/utils/derivedStats.js), `passiveBonuses.js` |
| Inventory virtual queries | [`src/rules/utils/inventoryVirtuals.js`](src/rules/utils/inventoryVirtuals.js) |
| Status/effect semantics | [`src/rules/utils/effectSemantics.js`](src/rules/utils/effectSemantics.js) |
| Electrocution logic | [`src/rules/utils/electrocute.js`](src/rules/utils/electrocute.js) |
| Quest system | [`src/rules/quests/`](src/rules/quests/) |
| Dialog system | [`src/rules/dialogues/`](src/rules/dialogues/) |
| VFX particles | [`src/display/fx/`](src/display/fx/) |
| Event wiring to display | [`src/display/ui/wiring/`](src/display/ui/wiring/) |
| Audio profiles | [`src/display/audio/`](src/display/audio/) |
| Glyph/color palette | [`src/display/palette/`](src/display/palette/) |
| Layer boundaries (import rules) | [`docs/arch/SEPARATION_MANIFEST.md`](docs/arch/SEPARATION_MANIFEST.md) |
| Entity topology (child entities) | [`docs/arch/RUNTIME_TOPOLOGY_DOCTRINE.md`](docs/arch/RUNTIME_TOPOLOGY_DOCTRINE.md) |
| Project philosophy | [`docs/arch/TEN_COMMANDMENTS.md`](docs/arch/TEN_COMMANDMENTS.md) |
| ECS library API | [`src/lib/ecs-js/AGENTS.md`](src/lib/ecs-js/AGENTS.md) |

---

## Before you merge

- [ ] No `Math.random()` in rules layer
- [ ] No system calling another system directly
- [ ] No `rules/` import inside `display/` or vice versa
- [ ] No DOM/window/timer references in `rules/`
- [ ] Symbol guard on every installed listener
- [ ] All new systems have Deno tests
- [ ] Spawn paths route through canonical constructors (no parity drift)
- [ ] Red-test triage done: stale expectations updated; no runtime rollback to satisfy legacy assertions
- [ ] Tested on mobile or DevTools mobile sim
- [ ] Commit message is descriptive (not "a", "fix", "wip")
- [ ] No build step added
