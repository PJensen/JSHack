// Visual scenario: goblin hunts player across an open room.
// Demonstrates basic aiChaseSystem pursuit along the dominant axis.

import { World } from '../../src/lib/ecs-js/index.js';
import { Position }      from '../../src/rules/components/Position.js';
import { Player }        from '../../src/rules/components/Player.js';
import { NamedIdentity } from '../../src/rules/components/NamedIdentity.js';
import { Faction }       from '../../src/rules/components/Faction.js';
import { MoveIntent }    from '../../src/rules/components/Intents/MoveIntent.js';
import { AggroState, AGGRO_LEVELS, SEARCH_TURNS_HUNTING_GRACE }
	from '../../src/rules/components/AggroState.js';
import { aiChaseSystem } from '../../src/rules/systems/aiChaseSystem.js';
import { clearAll, loadChunk, setTile }
	from '../../src/rules/environment/dungeon/tileMap.js';
import { CHUNK_SIZE, TILE_FLOOR, TILE_WALL }
	from '../../src/rules/environment/dungeon/constants.js';

function buildSteps(count) {
	const steps = [];
	for (let i = 0; i < count; i++) {
		steps.push({
			description: `Turn ${i + 1}: run aiChaseSystem, then apply move`,
			run(world) {
				// Clean previous intents
				for (const [id] of world.query(MoveIntent)) world.remove(id, MoveIntent);
				world.step++;
				aiChaseSystem(world);

				// Apply MoveIntents (mirrors movementSystem for position update)
				for (const [id, mi] of world.query(MoveIntent)) {
					const pos = world.get(id, Position);
					if (pos) { pos.x += mi.dx; pos.y += mi.dy; }
				}
			},
			check(world) {
				for (const [id, pos, ni] of world.query(Position, NamedIdentity)) {
					if (ni.identity !== 'goblin') continue;
					return { pass: true, message: `Goblin at (${pos.x}, ${pos.y})` };
				}
				return { pass: false, message: 'Goblin not found' };
			},
		});
	}
	return steps;
}

export default {
	name: 'Goblin Chase',
	description: 'A hunting goblin chases the player westward along an open corridor.',
	bounds: { x0: 0, y0: 0, x1: 15, y1: 10 },

	setup() {
		clearAll();
		const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
		loadChunk(0, 0, tiles);

		// Walls around the perimeter
		for (let x = 0; x <= 15; x++) { setTile(x, 0, TILE_WALL); setTile(x, 10, TILE_WALL); }
		for (let y = 0; y <= 10; y++) { setTile(0, y, TILE_WALL); setTile(15, y, TILE_WALL); }

		const world = new World({ seed: 1 });

		const player = world.create();
		world.add(player, Player);
		world.add(player, Position, { x: 3, y: 5 });
		world.add(player, NamedIdentity, { name: 'Hero', identity: 'player' });
		world.add(player, Faction, { key: 'player' });

		const goblin = world.create();
		world.add(goblin, Position, { x: 12, y: 5 });
		world.add(goblin, NamedIdentity, { name: 'Goblin', identity: 'goblin' });
		world.add(goblin, Faction, { key: 'enemy' });
		world.add(goblin, AggroState, {
			alertLevel: AGGRO_LEVELS.hunting,
			lastKnownX: 3, lastKnownY: 5,
			searchTurnsLeft: SEARCH_TURNS_HUNTING_GRACE,
			retreating: false,
		});

		const entities = new Map();
		entities.set(player, { label: 'Player', track: true });
		entities.set(goblin, { label: 'Goblin', track: true });

		return { world, entities };
	},

	steps: buildSteps(8),
};
