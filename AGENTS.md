# AGENTS.md - JSHack Field Manual

JSHack is a zero-dependency browser roguelike: pure JavaScript, pure ES modules,
ECS architecture, Deno tooling. This file is optimized for coding agents. Prefer
the commands below over manual spelunking.

Deeper docs:

- [README.md](README.md)
- [SEPARATION_MANIFEST.md](docs/architecture/SEPARATION_MANIFEST.md)
- [RUNTIME_TOPOLOGY_DOCTRINE.md](docs/architecture/RUNTIME_TOPOLOGY_DOCTRINE.md)
- [TEN_COMMANDMENTS.md](docs/architecture/TEN_COMMANDMENTS.md)
- [ecs-js/AGENTS.md](src/lib/ecs-js/AGENTS.md)

---

## Hard Laws

- **No build step.** Pure ES modules. No webpack, babel, JSX, TypeScript, or
  bundling.
- **Deno, not Node.** Tests and tools run with Deno. Default test command:
  `deno test --allow-read`.
- **JavaScript only.** Keep source as `.js` / `.mjs`.
- **Mobile-first.** Touch is primary; desktop keyboard is secondary.
- **Separation is law.** `rules/` never imports `display/` or `bridge/`;
  `display/` never imports `rules/`; `bridge/` projects read-only rule state.
- **No system-to-system calls.** Systems communicate with `world.emit` /
  `world.on`; scheduler owns ordering.
- **Adopt event classes and canonical installers organically.** When touching an
  event producer/consumer pair, prefer an `EcsEvent` class contract while
  keeping legacy string emissions where other consumers still depend on them.
  When touching listener installers, prefer `defineExtension(...)` with
  `world.install(...)` over bespoke symbol guards; keep existing `installX`
  wrappers as compatibility shims. Do not run broad migration sweeps just to
  chase this pattern.
- **No swallowed event failures.** Do not add `emitSafe`-style wrappers around
  `world.emit`.
- **Determinism is sacred.** In rules simulation use `world.rand()`, never
  `Math.random()`. No timers/fetch/promises/async in systems.
- **Integer grid only.** World coords may be negative. Do not clamp to `>= 0`;
  normalize with `Number.isFinite(v) ? (v | 0) : fallback`.
- **One canonical path.** Spawn, damage, spell cast, status application,
  inventory transfer, and materialization paths must delegate to the canonical
  implementation.
- **Runtime multiplicity is child entities.** Runtime
  effects/procs/sockets/enchantments are child topology, not arrays on parent
  components.
- **ECS-js is vendored.** Do not edit `src/lib/ecs-js/` unless fixing the ECS
  library itself.
- **Search before writing.** Extend existing patterns. Do exactly what was
  asked; no opportunistic content wiring or unrelated cleanup.

---

## Agent Commands

Run these before guessing.

### Guardrail Tasks

Prefer these Deno tasks over hand-assembled command strings:

```bash
deno task check
deno task guard:architecture
deno task guard:events
deno task guard:death
deno task guard:tools
```

- `check` runs the architecture and event doctrine guardrails.
- `guard:architecture` runs agent health, import boundaries, and architecture
  ratchet tests.
- `guard:events` runs event doctrine ratchets and prints the event bus summary.
- `guard:death` runs the focused death pipeline/domain migration suite.
- `guard:tools` verifies the agent-facing tools and prints the system map.

Audit-only tasks:

```bash
deno task audit:health
deno task audit:systems
deno task audit:events
deno task audit:damaged
deno task audit:died
```

### Project Health

```bash
deno run --allow-read tools/agent-health.mjs
deno run --allow-read tools/import-boundary-report.mjs
deno run --allow-read tools/system-map.mjs
```

`agent-health` summarizes boundary violations, remaining `emitSafe` refs,
nondeterminism hazards, generation-time async allowances, system counts, and
possible system-to-system calls. Classified allowances are context for agents;
headline hazards are the things to investigate first.

### Event Bus

```bash
deno run --allow-read tools/event-bus-explorer.mjs --format summary --top 40
deno run --allow-read tools/event-bus-explorer.mjs --format csv --event damaged
deno run --allow-read tools/event-bus-explorer.mjs --format mermaid --event damaged
deno run --allow-read tools/event-bus-explorer.mjs --producer-only --format summary --top 40
deno run --allow-read tools/event-bus-explorer.mjs --consumer-only --format summary --top 40
```

Use producer-only events to find emitted behavior with no consumer. Use
consumer-only events to find stale listeners, dynamic producers, or missing
producers.

### System Map

```bash
deno run --allow-read tools/system-map.mjs --format summary
deno run --allow-read tools/system-map.mjs --format csv
deno run --allow-read tools/system-map.mjs --phase effects
deno run --allow-read tools/system-map.mjs --unregistered
deno run --allow-read tools/system-map.mjs --missing-tests
```

Scheduler truth lives in [src/main/scheduler.js](src/main/scheduler.js). Some
imported-not-registered files are listener installers, not phase systems; audit
before deleting.

### Target Lookup

```bash
deno run --allow-read tools/agent-target.mjs damaged --limit 80
deno run --allow-read tools/content-id-audit.mjs goblin --limit 80
deno run --allow-read tools/content-id-audit.mjs potion_water --limit 80
```

`agent-target` is a ranked code search for events/functions/files/tests.
`content-id-audit` follows item, monster, spell, material, loot, visual, and
test references by ID.

### Focused Tests

```bash
deno test --allow-read tests/separationBoundaries.test.mjs
deno test --allow-read tests/determinismArchitectureGuards.test.mjs
deno test --allow-read tests/schedulerArchitectureGuards.test.mjs
deno test --allow-read tests/dealDamage.test.mjs
deno test --allow-read tests/castSpell.test.mjs
deno test --allow-read tests/interaction.test.mjs
deno test --allow-read tests/movementRefactored.test.mjs
deno test --allow-read tests/contentCatalogCanonical.test.mjs
```

Full runtime suite:

```bash
deno test --allow-read --no-check
```

Plain `deno test --allow-read` may fail during type-check on non-game packaging
scripts before tests run. Use `--no-check` when you need runtime coverage.

### Fast Greps

```bash
rg -n "world\\.(on|emit)\\s*\\(" src --glob '!src/lib/**'
rg -n "registerSystem\\(|install[A-Za-z0-9_]+\\(" src/main/scheduler.js
rg -n "Math\\.random|Date\\.now|setTimeout|setInterval|Promise|fetch|await" src/rules
rg -n "from ['\"].*display|from ['\"].*bridge" src/rules
rg -n "from ['\"].*rules" src/display
```

---

## Architecture Map

```text
rules/    deterministic simulation; no DOM, display, timers, async systems
bridge/   read-only projection from rules state to WorldView DTOs
display/  presentation only; reads WorldView and main-provided contracts
main/     wiring, lifecycle, input dispatch, scheduler setup
shared/   pure math/grid utilities; no ECS or DOM
lib/      vendored ecs-js and deity-js
content/  DSL-authored content definitions and content helpers
```

Five scheduler phases are declared in
[src/main/scheduler.js](src/main/scheduler.js):

```text
ai       intent producers
intents  movement/combat/use/cast/interaction consumers
effects  per-turn derived effects and world simulation
scripts  content DSL tick hooks
cleanup  entity removal, lifespan, spatial sync
```

The bridge contract is
[src/bridge/schema/worldView.js](src/bridge/schema/worldView.js). Display must
not push tags onto entity records; tag projection belongs in the bridge.

---

## Common Locations

| Need                 | Start Here                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Scheduler order      | [src/main/scheduler.js](src/main/scheduler.js)                                                                                                         |
| WorldView projection | [src/bridge/schema/worldView.js](src/bridge/schema/worldView.js)                                                                                       |
| Systems              | [src/rules/systems/](src/rules/systems/)                                                                                                               |
| Components           | [src/rules/components/](src/rules/components/)                                                                                                         |
| Monsters             | [src/content/monsters/](src/content/monsters/), [src/rules/data/monsters.js](src/rules/data/monsters.js)                                               |
| Items                | [src/content/items/](src/content/items/), [src/rules/data/itemCatalog.js](src/rules/data/itemCatalog.js)                                               |
| Spells               | [src/rules/data/spells.js](src/rules/data/spells.js), [src/rules/scripts/spells.js](src/rules/scripts/spells.js)                                       |
| Interaction payloads | [src/rules/content/interaction/interactPayloads.js](src/rules/content/interaction/interactPayloads.js)                                                 |
| Damage               | [src/rules/utils/dealDamage.js](src/rules/utils/dealDamage.js)                                                                                         |
| Status semantics     | [src/rules/utils/effectSemantics.js](src/rules/utils/effectSemantics.js), [src/rules/utils/statusFacade.js](src/rules/utils/statusFacade.js)           |
| Spatial queries      | [src/rules/utils/spatialIndex.js](src/rules/utils/spatialIndex.js)                                                                                     |
| Inventory            | [src/rules/utils/inventoryFacade.js](src/rules/utils/inventoryFacade.js), [src/rules/utils/inventoryVirtuals.js](src/rules/utils/inventoryVirtuals.js) |
| Materials/gems       | [src/rules/data/materials.js](src/rules/data/materials.js), [src/rules/data/gems.js](src/rules/data/gems.js)                                           |
| Dungeon tiles/FOV    | [src/rules/environment/dungeon/](src/rules/environment/dungeon/)                                                                                       |
| Quests/dialog        | [src/rules/quests/](src/rules/quests/), [src/rules/dialogues/](src/rules/dialogues/)                                                                   |
| Display event wiring | [src/display/ui/wiring/](src/display/ui/wiring/)                                                                                                       |
| Audio wiring         | [src/display/audio/](src/display/audio/)                                                                                                               |

---

## Patterns That Matter

### Listener Installers

Use symbol guards for install functions:

```js
const INSTALLED = Symbol.for("jshack:domain:feature:installed");

export function installFeatureListeners(world) {
  if (world[INSTALLED]) return;
  world[INSTALLED] = true;
  world.on("event:name", (payload) => {});
}
```

Install listeners from `configureWorld()` unless the feature is display/main
wiring.

### New Systems

1. Add `src/rules/systems/mySystem.js`.
2. Register it in [src/main/scheduler.js](src/main/scheduler.js) in the right
   phase.
3. Add a focused test in `tests/`.
4. Run `deno test --allow-read tests/mySystem.test.mjs`.

### Spatial Queries

Use `forEachInRadius`, `forEachInRect`, or tile query helpers. Do not full-scan
`world.query()` for proximity-sensitive behavior.

### Spawning

Route through canonical archetypes/materialization helpers. Debug spawns,
dungeon population, and spawner children must have parity tests if they differ.

### Events

Use direct `world.emit(event, payload)`. If an event should be visible to
display/audio/messages, verify with:

```bash
deno run --allow-read tools/event-bus-explorer.mjs --format csv --event event:name
```

---

## Red Tests

Tests can be stale. Do not make tests green by restoring old behavior unless the
user explicitly asks for that behavior.

Classify failures:

- **Real bug:** fix implementation.
- **Stale expectation:** update the test to current intended behavior.
- **Ambiguous:** stop and ask.

Prefer invariant tests over brittle snapshots: determinism, reachability,
bounds, parity, layer boundaries, canonical paths.

---

## Merge Checklist

- [ ] No build step or new dependency pipeline.
- [ ] No `Math.random()` in rules simulation.
- [ ] No `emitSafe` or swallowed event errors.
- [ ] No direct system-to-system calls.
- [ ] No illegal layer imports.
- [ ] New listeners have symbol guards.
- [ ] New systems are registered and tested.
- [ ] Spawn paths use canonical constructors/materializers.
- [ ] Event wiring checked with `tools/event-bus-explorer.mjs`.
- [ ] Agent health checked with `tools/agent-health.mjs`.
