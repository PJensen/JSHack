// Visual scenario: floating eye gaze mechanic.
// 8 consecutive turns in LOS -> player is stunned for 3 turns and gains mindwipe.

import { World } from '../../src/lib/ecs-js/index.js';
import { Position }      from '../../src/rules/components/Position.js';
import { Player }        from '../../src/rules/components/Player.js';
import { NamedIdentity } from '../../src/rules/components/NamedIdentity.js';
import { Faction }       from '../../src/rules/components/Faction.js';
import { MoveIntent }    from '../../src/rules/components/Intents/MoveIntent.js';
import { AggroState, AGGRO_LEVELS, SEARCH_TURNS_HUNTING_GRACE }
	from '../../src/rules/components/AggroState.js';
import { Speed }         from '../../src/rules/components/Speed.js';
import { Brain }         from '../../src/rules/components/Brain.js';
import { ActiveEffects } from '../../src/rules/components/ActiveEffects.js';
import { aiChaseSystem } from '../../src/rules/systems/aiChaseSystem.js';
import { clearAll, loadChunk, setTile } from '../../src/rules/environment/dungeon/tileMap.js';
import { CHUNK_SIZE, TILE_FLOOR, TILE_WALL } from '../../src/rules/environment/dungeon/constants.js';

/** Simulate one turn spent in the eye's gaze. */
function gazeStep(label, turnNum) {
	return {
		description: `${label}: Player remains in the gaze (${turnNum}/8)`,
		run(world) {
			for (const [id] of world.query(MoveIntent)) world.remove(id, MoveIntent);
			world.step++;
			aiChaseSystem(world);
			if (world.has(world._eyeId, MoveIntent)) world.remove(world._eyeId, MoveIntent);
		},
	check(world) {
			const ae = world.get(world._playerId, ActiveEffects);
			const stun = ae?.effects?.find(e => e.key === 'stun');
			const mindwipe = ae?.effects?.find(e => e.key === 'mindwipe');
			if (turnNum < 8) {
				return stun
					? { pass: false, message: `Stun applied too early on turn ${turnNum}!` }
					: { pass: true, message: `Exposure ${turnNum}/8 — no proc yet` };
			}
			return (stun && mindwipe)
				? { pass: true, message: `STUNNED for 3 turns! Mindwipe applied at threshold (${mindwipe.stacks} stack)` }
				: { pass: false, message: `Expected stun + mindwipe at turn 8 but got ${JSON.stringify(ae?.effects || [])}` };
		},
	};
}

/** Simulate one turn with a wall blocking the eye's line of sight. */
function breakLOSStep(label) {
	return {
		description: `${label}: LOS breaks for one turn`,
		run(world) {
			for (const [id] of world.query(MoveIntent)) world.remove(id, MoveIntent);
			setTile(7, 5, TILE_WALL);
			world.step++;
			aiChaseSystem(world);
			setTile(7, 5, TILE_FLOOR);
			if (world.has(world._eyeId, MoveIntent)) world.remove(world._eyeId, MoveIntent);
		},
		check(world) {
			return { pass: true, message: 'Gaze charge reset by broken LOS' };
		},
	};
}

export default {
	name: 'Floating Eye Stun',
	description: 'A floating eye builds gaze charge over 8 consecutive LOS turns, then applies a 3-turn stun and mindwipe. Breaking LOS resets the charge.',
	bounds: { x0: 2, y0: 2, x1: 12, y1: 8 },

	setup() {
		clearAll();
		const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
		loadChunk(0, 0, tiles);

		const world = new World({ seed: 1 });

		const player = world.create();
		world.add(player, Player);
		world.add(player, Position, { x: 5, y: 5 });
		world.add(player, NamedIdentity, { name: 'Hero', identity: 'player' });
		world.add(player, Faction, { key: 'player' });
		world.add(player, ActiveEffects, { effects: [] });

		const eye = world.create();
		world.add(eye, Position, { x: 9, y: 5 });
		world.add(eye, NamedIdentity, { name: 'Floating Eye', identity: 'floating_eye' });
		world.add(eye, Faction, { key: 'enemy' });
		world.add(eye, AggroState, {
			alertLevel: AGGRO_LEVELS.hunting,
			lastKnownX: 5, lastKnownY: 5,
			searchTurnsLeft: SEARCH_TURNS_HUNTING_GRACE,
			retreating: false,
		});
		world.add(eye, Speed, { actEvery: 3 });
		world.add(eye, Brain, { intelligence: 2, visionRange: 6 });

		// Stash entity IDs on world for easy access in steps
		world._playerId = player;
		world._eyeId = eye;

		const entities = new Map();
		entities.set(player, { label: 'Player', track: true });
		entities.set(eye,    { label: 'Floating Eye', track: true });

		return { world, entities };
	},

	steps: [
		gazeStep('Turn 1', 1),
		gazeStep('Turn 2', 2),
		gazeStep('Turn 3', 3),
		gazeStep('Turn 4', 4),
		gazeStep('Turn 5', 5),
		gazeStep('Turn 6', 6),
		gazeStep('Turn 7', 7),
		breakLOSStep('Turn 8'),
		gazeStep('Turn 9', 1),
		gazeStep('Turn 10', 2),
		gazeStep('Turn 11', 3),
		gazeStep('Turn 12', 4),
		gazeStep('Turn 13', 5),
		gazeStep('Turn 14', 6),
		gazeStep('Turn 15', 7),
		gazeStep('Turn 16', 8),
	],
};
