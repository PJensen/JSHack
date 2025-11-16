NEWS: hopefully a release tomorrow.

# JS-Hack

A hackable, zero-dependency, browser-based like engine built with pure JavaScript and a Entity-Component-System (ECS) architecture. Designed for experimentation and exploration.

## Building

Execute `./build.ps1` to check for errors

## Prime Directives

- **Pure ES Modules**: No build step, no bundler. Works by opening `index.html` directly or serving via a static server.
- **ECS Architecture**: Composable ECS core with archetypes, systems, and components.
- **Deterministic**: Seeded RNG for reproducible runs and debugging. 0xC0FFEE
- **Hackable**: Modular codebase, easy to inspect and extend. One file = one idea.
- **Mobile-Friendly**: Responsive UX skeleton for desktop and mobile.
- **Shims, Adapters and Compatibility:** Never try to make something backwards compatible. Just re-work it.
- - **Logging:** Never spam log messages. 

## Quick Start

### Performance/Quality controls

Mobile GPUs have limited fill-rate. The renderer now exposes a few conservative switches that keep visuals consistent while reducing per-frame work:

- URL params (or matching localStorage keys) — set once and reload:
	- `?quality=low|auto|high` — presets for glow layers and particle capacity
	- `?dprCap=<number>` — caps devicePixelRatio used for the canvas (default auto: 1.5–2 on high-DPR devices)

Examples:

- `index.html?quality=low` — disables glyph glow, halves particle pool, caps DPR to 1
- `index.html?dprCap=2` — keeps crispness but avoids 3×/4× DPR overload on phones

These controls operate entirely in display/ and do not affect deterministic rules/.
1. **Clone or Download** this repository.
2. **Open `index.html`** in your browser _or_ serve the folder with a static server:

	```sh
	# Python 3.x
	python -m http.server 8000
	# or use any static server
	```
3. Play in your browser! No build or install required.

## Controls

- Keyboard
	- Arrow keys / WASD / HJKL: Move
	- . (period): Wait a turn
	- , (comma): Open pickup chooser for items underfoot
	- Q: Drink a potion (from inventory UI)
	- +/- or Numpad +/-: Zoom in/out; 0: Reset camera
	- X: Quick camera shake (demo)

- Touch / Pointer
	- Single tap: Move toward the tapped screen side (cardinal)
	- Double tap (quick): Pick up items underfoot (opens chooser if multiple)
	- Pinch: Zoom in/out
	- Swipe right: Open inventory
	- Swipe down: Open message log

## Mobile-friendly item pickups

When you walk over a non-currency item, a WoW-style tooltip appears near the bottom. Tap it to pick up the item. If multiple items are on the tile, tapping opens a simple chooser.

Manual pickups respect a per-actor `Settings.pickupRange` (in tiles; default 1). This allows adjacent pickups on touch devices without precise stepping.

## Project Structure

- `index.html` — Main entry point for the game.
- `src/` — Source code (ECS core, systems, components, utilities).
- `reference/` — Demos and implementation references.
- `world/` — Game-specific archetypes, components, data, and systems.

## How It Works

- The game boots from `src/main.js`, which sets up the canvas and ECS world.
- All logic is organized into ES modules. Systems iterate over entities with matching components.
- Archetypes provide prefab-like entity creation.
- No frameworks, no transpilers, no dependencies.

## Turn and Combat Rules

- Strict turns: player acts, then all monsters act, then back to player; one action per entity per round.
- Player input is only accepted on the player's turn; monster AI only runs on the monsters' turn.
- Actions that consume a turn include: moving one tile, opening a door, or initiating a melee attack.
- Melee attacks use DnD-like resolution:
	- Roll d20 + attackBonus vs target's armorClass; natural 1 always misses, natural 20 always crits.
	- On hit, roll damage from atkMin..atkMax; crits multiply damage by critMult.
	- Optional flat mitigation from defense is applied after damage.
	- Defaults come from `CombatStats` and can be modified by equipment.

## Development

- Edit or add modules in `src/` or `world/` to extend the game.
- Use the reference demos in `reference/` for learning or testing ECS features.
- All code is MIT licensed and intended for learning, hacking, and rapid prototyping.

## Effects & Status (rules/)

- Active effects are stored in `ActiveEffects.effects` on an entity as records like `{ key, turnsLeft, potency?, stacks?, onsetLeft? }`.
- The `effectSystem` runs each tick and applies gameplay results:
	- `poison` and `burn` deal damage over time to `Vitality.hp`.
	- `regeneration` heals each tick up to `Vitality.maxHp`.
	- `stun` sets a status flag (no movement/AI gating yet).
- Current statuses are mirrored into `Status.statuses` each tick (e.g., `poisoned`, `burning`). When an entity has no effects, statuses clear automatically.

Example: Apply poison to the player for 3 turns at 2 damage per tick by pushing `{ key:'poison', turnsLeft:3, potency:2 }` into the player's `ActiveEffects.effects`. On each world tick, hp will drop by 2 until the effect expires, and the `poisoned` status will appear during the duration.

## End-of-turn cleanup

- A dedicated `cleanup` phase runs at the end of each world tick. It currently removes any entity with `Vitality.hp <= 0` to prevent "dead men walking" in subsequent turns. Systems can react to deaths (events, affixes, VFX, logging) earlier in the tick; removal is deferred until this phase to keep ordering deterministic.

## Contributing

Contributions, bug reports, and suggestions are welcome! Please open an issue or submit a pull request.

## License

MIT License. See [LICENSE](LICENSE) for details.

## Banned Words, Concepts and Tools

- "game", "sprite", "assets", "toy"
- "node", "typescript", ".t.ds"
---
