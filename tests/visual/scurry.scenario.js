// Visual scenario: dumb unaware rats wander randomly via aiScurrySystem.
// Demonstrates the 50% rest / 50% move coin flip and directional wandering.

import { World } from '../../src/lib/ecs-js/index.js';
import { Position }      from '../../src/rules/components/Position.js';
import { Player }        from '../../src/rules/components/Player.js';
import { NamedIdentity } from '../../src/rules/components/NamedIdentity.js';
import { Faction }       from '../../src/rules/components/Faction.js';
import { MoveIntent }    from '../../src/rules/components/Intents/MoveIntent.js';
import { AggroState, AGGRO_LEVELS } from '../../src/rules/components/AggroState.js';
import { aiScurrySystem } from '../../src/rules/systems/aiScurrySystem.js';
import { clearAll, loadChunk } from '../../src/rules/environment/dungeon/tileMap.js';
import { CHUNK_SIZE, TILE_FLOOR } from '../../src/rules/environment/dungeon/constants.js';

function buildSteps(count) {
	const steps = [];
	for (let i = 0; i < count; i++) {
		steps.push({
			description: `Turn ${i + 1}: run aiScurrySystem`,
			run(world) {
				// Clean previous intents and apply any pending moves
				for (const [id, mi] of world.query(MoveIntent)) {
					const pos = world.get(id, Position);
					if (pos) { pos.x += mi.dx; pos.y += mi.dy; }
					world.remove(id, MoveIntent);
				}
				world.step++;
				aiScurrySystem(world);
			},
			check(world) {
				const results = [];
				for (const [id, pos, ni] of world.query(Position, NamedIdentity)) {
					if (ni.identity !== 'rat') continue;
					const mi = world.get(id, MoveIntent);
					if (mi) {
						results.push(`${ni.name} moves (dx=${mi.dx}, dy=${mi.dy})`);
					} else {
						results.push(`${ni.name} rests`);
					}
				}
				return { pass: true, message: results.join(' | ') };
			},
		});
	}
	return steps;
}

export default {
	name: 'Rat Scurry',
	description: 'Two unaware rats wander randomly. Each turn they have a 50% chance to rest or move in a random direction.',
	bounds: { x0: 0, y0: 0, x1: 11, y1: 11 },

	setup() {
		clearAll();
		const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
		loadChunk(0, 0, tiles);

		const world = new World({ seed: 42 });

		const player = world.create();
		world.add(player, Player);
		world.add(player, Position, { x: 6, y: 6 });
		world.add(player, NamedIdentity, { name: 'Hero', identity: 'player' });
		world.add(player, Faction, { key: 'player' });

		const rat1 = world.create();
		world.add(rat1, Position, { x: 3, y: 3 });
		world.add(rat1, NamedIdentity, { name: 'Rat A', identity: 'rat' });
		world.add(rat1, Faction, { key: 'enemy' });
		world.add(rat1, AggroState, {
			alertLevel: AGGRO_LEVELS.unaware,
			lastKnownX: 0, lastKnownY: 0, searchTurnsLeft: 0, retreating: false,
		});

		const rat2 = world.create();
		world.add(rat2, Position, { x: 9, y: 9 });
		world.add(rat2, NamedIdentity, { name: 'Rat B', identity: 'rat' });
		world.add(rat2, Faction, { key: 'enemy' });
		world.add(rat2, AggroState, {
			alertLevel: AGGRO_LEVELS.unaware,
			lastKnownX: 0, lastKnownY: 0, searchTurnsLeft: 0, retreating: false,
		});

		const entities = new Map();
		entities.set(player, { label: 'Player', track: false });
		entities.set(rat1,   { label: 'Rat A', track: true });
		entities.set(rat2,   { label: 'Rat B', track: true });

		return { world, entities };
	},

	steps: buildSteps(8),
};
