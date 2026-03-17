# JSHack ⚡

[🎮 Play JSHack](https://pjensen.github.io/JSHack/)

**A mobile-first roguelike built to be hacked.**

Pure JavaScript. Zero dependencies. No build step. Serve the folder, open the page, and start playing. Edit a file, hit refresh, see your changes instantly. This is JavaScript the way it was meant to be: hackable, transparent, and fun.

---

## What makes this different?

### 🚀 Zero build step, zero dependencies

No npm. No webpack. No babel. No TypeScript. Just **pure ES modules** that run directly in your browser. Serve the project folder, open the page, and you're playing. Edit `src/rules/systems/movementSystem.js`, refresh, and your changes are live. No waiting, no compilation, no mysterious build errors.

```bash
# Any static HTTP server works. ES modules require it.
python3 -m http.server 8000
# Then open http://localhost:8000
```

### 📱 Mobile-first, touch-first

This isn't "mobile-friendly" — it's **mobile-native**. Touch controls are primary. Designed for phones. Keyboard works great too, but we built this for your thumb on a subway, not a mouse at a desk.

- Tap sides to move (cardinal directions)
- Double-tap to pick up items
- Pinch to zoom
- Swipe right for inventory, down for messages

All UI elements are finger-sized. No hover states. No tiny tap targets. Just intuitive touch controls that work.

### 🎲 Deterministic and replayable

Every run is seeded (default: `0xC0FFEE` ☕). Same seed + same inputs = same outcome, every time. Debug by replaying. Share interesting seeds. Build regression tests that actually work.

```js
const world = new World({ seed: 0xDEADBEEF });
world.tick(1); // Perfectly reproducible
```

### 🏗️ ECS architecture you can actually see

Built on a clean **Entity-Component-System** architecture. Not hidden behind abstractions — you can see exactly how entities, components, and systems work. Want to understand ECS? Read the source. It's just JavaScript.

- **Entities** are IDs
- **Components** are plain objects
- **Systems** are functions that query and modify components

No magic. No framework ceremony. Just composable logic.

### 🧩 One file = one idea

Every file has a single, clear purpose. Want to change how movement works? Open [movementSystem.js](src/rules/systems/movementSystem.js). Want to add a new monster? Create an archetype in [Creatures.js](src/rules/archetypes/Creatures.js). The codebase is organized for humans, not bundlers.

### 🎨 Church and State separation

Deterministic simulation (`rules/`) is completely separate from rendering (`display/`). The rules layer has **zero DOM, zero rendering, zero async code**. It's pure, testable logic. The display layer consumes a stable snapshot and renders however it wants. You can swap renderers, run headless tests, or replay demos without touching game logic.

See [SEPARATION_MANIFEST.md](SEPARATION_MANIFEST.md) for the philosophy.

### 🔧 Built to be hacked

We're not "shipping a product" — we're **exploiting JavaScript for fun**. Clever tricks encouraged. Weird experiments welcome. Open your console, poke around, break things, fix them. This is a playground.

Every decision prioritizes hackability:
- No transpilation (edit and refresh)
- No bundling (import real files)
- No frameworks (see the actual code)
- No abstractions (everything is transparent)

If you can `console.log` it, you can understand it.

---

## Getting Started

### Play it in 30 seconds

```bash
git clone https://github.com/PJensen/JSHack.git
cd JSHack
python3 -m http.server 8000
# Open http://localhost:8000
```

Any static HTTP server works — ES modules need to be served over HTTP, not opened as `file://` URLs. No `npm install`. No `npm run build`. Just serve and play.

### Controls

**Touch / Mobile (primary):**
- **Tap screen sides**: Move in that direction
- **Double-tap**: Pick up items at your feet
- **Pinch**: Zoom in/out
- **Swipe right**: Open inventory
- **Swipe down**: Open message log

**Keyboard (also works):**
- **Arrow keys / WASD / HJKL**: Move (pick your poison)
- **. (period)**: Wait a turn
- **, (comma)**: Pick up items
- **Q**: Drink a potion
- **+/- (or numpad)**: Zoom in/out
- **0**: Reset zoom
- **X**: Camera shake demo (because why not)

### Performance tuning

On older phones or just want better framerates? Add URL params:

```
index.html?quality=low    # Fast mode: no glow, fewer particles
index.html?quality=high   # Full eye candy
index.html?dprCap=1       # Force 1x pixel density (speed boost)
```

These only affect visuals — the deterministic simulation stays identical.

---

## How It Works

### The 30-second architecture tour

```
src/
  rules/     — Pure deterministic simulation (the roguelike logic)
  bridge/    — Stable contract between rules and display
  display/   — Rendering, particles, camera, input handling
  main/      — Wires everything together
```

**Rules** never import **Display**. **Display** never imports **Rules**. They talk through a clean **Bridge** contract. This keeps the simulation pure and deterministic while letting the visuals do whatever they want.

### Turn-based simulation

Strict turn order: player acts → all monsters act → effects trigger → cleanup runs → back to player. One action per entity per turn. No realtime chaos.

Actions that consume a turn:
- Moving one tile
- Attacking something
- Using an item
- Waiting (yes, waiting is an action)

### Combat rules (D&D-style)

```
Attacker rolls: d20 + attackBonus
Target has: armorClass

Hit if roll ≥ AC
Natural 1: always miss
Natural 20: always crit (damage × critMult)

Damage: roll(minDamage, maxDamage) - defense
```

Equipment modifies your stats. Affixes add special effects. Crits feel good.

### Systems run in phases

Systems are organized into three phases:

1. **intents**: AI, player input, movement, combat, interactions
2. **effects**: Status effects, equipment bonuses, hunger, mana regen, spawners
3. **cleanup**: Remove dead entities, update spatial index

See [scheduler.js](src/main/scheduler.js) for the full registration order. Add your own systems by registering them to a phase. Systems never call other systems — they emit events instead.

### Action transactions vs intents

JSHack also has a rules-layer action transaction utility (`src/rules/interaction/mutations.js`) used by action contexts (item use/apply/eat) for commit-or-cancel behavior.

- Use **intents + phases** for system ordering and turn flow.
- Use **action transactions** only for local all-or-nothing mutation batches inside a single action resolver.
- Do not treat action transactions as a second scheduler or engine queue. ECS-js remains the only engine-level deferred command system.

### Components are just frozen objects

```js
export const Position = Object.freeze({
  x: 0,
  y: 0,
});

export const Vitality = Object.freeze({
  hp: 10,
  maxHp: 10,
});
```

That's it. No classes. No inheritance. Just plain data.

### Archetypes spawn entities

```js
import { Goblin } from './rules/archetypes/Creatures.js';
import { createFrom } from './lib/ecs-js/archetype.js';

const goblinId = createFrom(world, Goblin, { x: 10, y: 10 });
```

Archetypes are templates. Spawn as many as you want. Modify their components. They're just entities.

---

## Hacking on JSHack

### Make a new monster in 2 minutes

1. Open [src/rules/archetypes/Creatures.js](src/rules/archetypes/Creatures.js)
2. Copy an existing monster definition
3. Change the stats (hp, damage, XP, name)
4. Refresh your browser
5. Your monster spawns

No compilation. No bundling. Just edit and refresh.

### Add a new system

1. Create `src/rules/systems/mySystem.js`:
   ```js
   export function mySystem(world, dt) {
     for (const [id, pos, thing] of world.query(Position, Thing)) {
       // Your logic here
     }
   }
   ```

2. Register it in [src/main/scheduler.js](src/main/scheduler.js):
   ```js
   import { mySystem } from '../rules/systems/mySystem.js';
   registerSystem(mySystem, 'intents'); // or 'effects' or 'cleanup'
   ```

3. Refresh browser

4. Your system runs every tick

### Debug with determinism

```js
// In your browser console
const world = new World({ seed: 0xC0FFEE });
// ...set up your scenario...
world.tick(1); // Run one turn
world.tick(1); // Run another

// Same seed, same setup → same results, always
```

Replay bugs. Share seeds. Build regression tests. Determinism is your superpower.

### Emit events, not calls

Systems communicate via events, never direct calls:

```js
// ✅ GOOD: Emit an event
world.emit('combat:hit', { attackerId, targetId, damage });

// ❌ BAD: Call another system
combatSystem(world, dt); // Never do this!
```

Events keep the scheduler in control and execution order predictable.

---

## What's Inside?

### 🎮 Core Features

- **Turn-based roguelike gameplay** — classic dungeon crawling with multi-floor dungeons
- **4 character classes** — Warlock, Archaeologist, Cleric, Druid — each with unique starting gear
- **Monster AI** — 10-level intelligence tiers driving pack alerting, retreat, ambush, and scurry
- **28 monsters across 4 tiers** — rats to dragons, with flying creatures and gaze attacks
- **Item system** — 363+ items: potions, scrolls, weapons, armor, wands, gems, crafting materials
- **Magic system** — 15 spells across destruction, support, and summoning schools; channeling and INT-based crits
- **Dual-wielding** — equip two one-handed weapons with offhand penalties
- **Equipment** — canonical gear slots (weapon, offhand, armor, helmet, ring, ammo) with affix modifiers
- **Status effects** — poison, burn, regen, stun, berserk, curse, confusion, paralysis, and more
- **Hunger & survival** — eat food or suffer; carry weight and encumbrance matter
- **Deity favor** — worship gods, gain boons or invoke wrath; ascetic and dietary tracking
- **Pet companions** — they follow, fight, and have opinions
- **Overworld village** — 11 NPC townspeople with scheduled daily routines and a full economy chain
- **Weather system** — rain and heavy rain with gameplay effects (extinguishes fire, waters crops)
- **Calendar** — 13 lunar months, 8 moon phases, archaic week, 4 seasons
- **Plant growth & farming** — crops grow through visual stages, harvestable resources regrow
- **Quests** — quest system with NPC quest givers and economy-driven objectives
- **Crafting** — alchemy bench, smithing window, cooking with stateful furnace
- **Traps** — pressure plates, arrow traps, spike pits — and you can disarm them
- **Shops** — buy and sell items with appraisal pricing
- **Dungeon generation** — procedural levels with biome slices, Perlin noise, and boulder puzzles
- **FOV & exploration** — shadowcasting visibility, fog of war, lantern vision
- **Identification & curses** — unidentified items and cursed gear
- **Score system** — your performance is quantified
- **Fire spread** — flames propagate across structures and can be extinguished by rain

### 🔧 Developer Tools

- **Deterministic replay** — seeded RNG for perfect reproducibility
- **Rules profiler** — per-system timing (`?rulesProfile=1`)
- **Event system** — inter-system communication without coupling
- **Spatial indexing** — fast radius queries for AI and effects
- **Script system** — attach behavior to entities without hardcoding
- **Hot reload** — edit JS, refresh browser, see changes instantly
- **1,086 tests** across 209 test files — Deno-powered, deterministic, no flakes
- **PWA** — installable on mobile, no app store required
- **Debug console** — spawn monsters, inspect state, remembers prior commands

### 📚 Content

- **72 systems** — movement, combat, AI, items, effects, weather, economy, crafting, spawning, cleanup
- **105 components** — Position, Vitality, Inventory, Brain, Equipment, WeatherState, CalendarState, TownfolkJob, and more
- **16 archetype files** — Player, Creatures, Items, Tiles, Doors, Stairs, Traps, Food, TownGoods, Overworld, etc.
- **15 spells** — destruction (lightning, meteor, blizzard, firestorm, shadow bolt), support (heal, flash heal), summoning (skeleton), teleportation (blink, homecoming)
- **28 monsters across 4 dungeon tiers** — rats and goblins up through dragons, mind flayers, and ancient wyrms
- **363+ items** — weapons, armor, potions, scrolls, gems, crafting materials, food, tools
- **11 NPC townspeople** — farmer, smith, miner, barkeep, herbalist, and more — with full economy simulation
- **Deity pantheon** — multiple gods with unique mechanics, dietary tracking, and ascetic hooks

All data-driven. All modifiable. All in plain JavaScript files.

---

## Project Structure

```
JSHack/
├── index.html              # Entry point (serve over HTTP)
├── src/
│   ├── rules/              # Pure deterministic simulation
│   │   ├── systems/        # 72 game logic systems
│   │   ├── components/     # 105 data containers
│   │   ├── archetypes/     # Entity templates
│   │   ├── scripts/        # Behavior hooks (spells, items, traps)
│   │   ├── data/           # Spells, monsters, items, loot tables, calendar
│   │   ├── quests/         # Quest definitions and runtime
│   │   ├── content/        # Interactions, dialog, NPC behaviors
│   │   └── environment/    # Dungeon generation, overworld, FOV, tiles
│   ├── bridge/             # Rules ↔ Display contract
│   │   └── schema/         # WorldView, MapView DTOs
│   ├── display/            # Rendering & presentation
│   │   ├── passes/         # Render pipeline (glyphs, VFX, particles)
│   │   ├── fx/             # Weather, projectile, cloud, spell area VFX
│   │   ├── camera/         # Camera controller, follow, shake, zoom
│   │   ├── input/          # Touch & keyboard input routing
│   │   ├── ui/             # HUD, inventory, messages, overlays
│   │   └── palette/        # Visual mappings (glyphs, colors)
│   ├── main/               # Application wiring
│   │   ├── scheduler.js    # System registration & phases
│   │   └── input/          # Input → Intent conversion
│   ├── shared/             # Pure utilities (math, grid algorithms)
│   └── lib/                # Vendored libraries (ecs-js, deity-js)
├── tests/                  # 209 test files, 1,086 tests (Deno)
├── reference/              # Demos and examples
└── AGENTS.md               # Guide for AI/autonomous agents
```

**Design principle**: Import boundaries enforce separation. Rules can't import Display. Display can't import Rules. Bridge is the contract. See [SEPARATION_MANIFEST.md](SEPARATION_MANIFEST.md) for details.

---

## Philosophy

### We believe in:

- **Zero build steps** — pure ES modules, instant feedback
- **Determinism** — seeded RNG, reproducible runs, testable logic
- **Transparency** — no frameworks, no magic, just readable code
- **Hackability** — one file = one idea, easy to modify
- **Mobile-first** — touch is primary, phones are the platform
- **Fun** — we're hacking and exploring JavaScript, not shipping enterprise software

### We avoid:

- ❌ Build tools (webpack, babel, rollup)
- ❌ Frameworks (React, Vue, Angular)
- ❌ Dependencies (zero npm packages)
- ❌ TypeScript (just JavaScript)
- ❌ Node (we use Deno for tests)
- ❌ Backwards compatibility hacks (just rework it)

**If you can't `console.log` it and understand it immediately, we're doing it wrong.**

For more on why we reject the modern web toolchain, read [The Modern Web is a UX Crime Scene](https://pjensen.substack.com/p/the-modern-web-is-a-ux-crime-scene). This project is proof of what native browser tooling can do without the bullshit — and a major proof of what agentic AI development looks like when the codebase is simple enough for both humans and agents to reason about.

---

## Advanced Topics

### Status Effects

Apply effects to entities:

```js
const effects = world.get(entityId, ActiveEffects) || { effects: [] };
effects.effects.push({
  key: 'poison',      // Effect type
  turnsLeft: 5,       // Duration
  potency: 2,         // Damage per turn
});
world.set(entityId, ActiveEffects, effects);
```

Effects tick automatically. Poison deals damage. Regen heals. Stun... stuns. Current statuses are mirrored to the `Status` component each tick for easy querying.

### Scripting System

Attach behavior to entities without hardcoding systems:

```js
// In src/rules/scripts/myScript.js
import { registerScript, ScriptVerb } from '../scripting.js';

registerScript('lightning_wand', {
  [ScriptVerb.ItemUse]: (world, ctx) => {
    const { userId, targetX, targetY } = ctx;
    // Zap logic here
    world.emit('damage', { id: targetId, amount: 10 });
  }
});

// Attach to entity
world.set(wandId, ScriptRef, { ref: 'lightning_wand' });
```

Scripts respond to verbs: `spell:cast`, `item:use`, `trap:trigger`, `affix:onHit`, etc.

### Event System

Systems communicate via events to avoid coupling:

```js
// System A emits
world.emit('combat:hit', { attackerId, targetId, damage });

// System B listens (installed once at startup)
const INSTALLED = Symbol.for('jshack:combatLogger:installed');
if (!world[INSTALLED]) {
  world[INSTALLED] = true;
  world.on('combat:hit', ({ attackerId, targetId, damage }) => {
    console.log(`Entity ${attackerId} hit ${targetId} for ${damage} damage`);
  });
}
```

Events flow through the world. Systems stay decoupled. Order is predictable.

### Spatial Queries

Fast radius queries for AI, explosions, AOE:

```js
import { forEachInRadius } from './rules/utils/spatialIndex.js';

forEachInRadius(world, x, y, radius, (entityId) => {
  // Apply damage, effects, etc.
});
```

Maintained automatically by `spatialIndexSystem` in the cleanup phase.

---

## Testing

We use **Deno** (not Node) for testing:

```bash
deno test --allow-read tests/
deno run tests/movementSystem.test.js
```

Tests are simple:

```js
import { World } from '../src/lib/ecs-js/index.js';
import { movementSystem } from '../src/rules/systems/movementSystem.js';

const world = new World({ seed: 42 });
// ...setup...
movementSystem(world, 1);
// ...assert...
```

Deterministic seeds mean tests are reproducible. No flaky tests. No "works on my machine."

---

## Contributing

Contributions that align with the project's vision are welcome. Read **[CONTRIBUTING.md](CONTRIBUTING.md)** for setup, guidelines, and expectations. The short version: keep it simple, test your changes, don't break the constraints in [TEN_COMMANDMENTS.md](TEN_COMMANDMENTS.md).

---

## For AI Agents & Copilots

If you're an autonomous agent or LLM-based copilot reading this:

👉 **Read [AGENTS.md](AGENTS.md) first.** It has everything you need to work with this codebase effectively.

Key rules:
- ECS-js is external; only fix genuine bugs
- No system-to-system calls; use events with Symbol tracking
- Mobile-first always (touch is primary)
- Church (display) and State (rules) are separated
- Deno, not Node

---

## Resources

### Documentation

- **[AGENTS.md](AGENTS.md)** — Guide for AI agents and autonomous operators
- **[TEN_COMMANDMENTS.md](TEN_COMMANDMENTS.md)** — Project philosophy and constraints
- **[SEPARATION_MANIFEST.md](SEPARATION_MANIFEST.md)** — Layer boundaries and import rules
- **[ecs-js](http://github.com/pjensen/ecs-js)** — Canonical ECS library (external dependency)
- **[ecs-js README](src/lib/ecs-js/README.md)** — Vendored ECS core API docs
- **[ecs-js AGENTS.md](src/lib/ecs-js/AGENTS.md)** — ECS-specific guidance

### Inspiration

- [Roguelike Development Guide](http://www.roguebasin.com/)
- [ECS Architecture](https://en.wikipedia.org/wiki/Entity_component_system)
- Classic roguelikes: NetHack, DCSS, Brogue

---

## License

Human-Scale Source License (HSSL) v1.2

See [LICENSE](LICENSE) for terms.

---

## Why JSHack?

Because JavaScript doesn't need frameworks and build tools to be powerful. Because mobile deserves great roguelikes. Because deterministic simulations are beautiful. Because one file should equal one idea. Because hacking should be fun.

**Serve the folder. Edit a file. Refresh. Hack.**

That's it. That's the whole pitch.

Now go build something weird. ⚡

---

**Follow development:** [hackjs.substack.com](http://hackjs.substack.com/)

---

*Built with ☕ (0xC0FFEE) and pure JavaScript.*
