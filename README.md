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

1. **Clone or Download** this repository.
2. **Open `index.html`** in your browser _or_ serve the folder with a static server:

	```sh
	# Python 3.x
	python -m http.server 8000
	# or use any static server
	```
3. Play in your browser! No build or install required.

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

## Contributing

Contributions, bug reports, and suggestions are welcome! Please open an issue or submit a pull request.

## License

MIT License. See [LICENSE](LICENSE) for details.

## Banned Words, Concepts and Tools

- "game", "sprite", "assets", "toy"
- "node", "typescript", ".t.ds"
---