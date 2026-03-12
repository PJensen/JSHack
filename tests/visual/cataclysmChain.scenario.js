import { World } from '../../src/lib/ecs-js/index.js';
import { ActiveEffects } from '../../src/rules/components/ActiveEffects.js';
import { Faction } from '../../src/rules/components/Faction.js';
import { NamedIdentity } from '../../src/rules/components/NamedIdentity.js';
import { Position } from '../../src/rules/components/Position.js';
import { Vitality } from '../../src/rules/components/Vitality.js';
import { CHUNK_SIZE, TILE_FLOOR } from '../../src/rules/environment/dungeon/constants.js';
import { clearAll, loadChunk } from '../../src/rules/environment/dungeon/tileMap.js';

export default {
	name: 'Cataclysm Chain',
	description: 'A crit kill forks ✦ marks onto nearby enemies. Both goblins show the badge. Hitting a marked target consumes the mark — badge disappears on that goblin only.',
	bounds: { x0: 2, y0: 2, x1: 7, y1: 6 },

	setup() {
		clearAll();
		const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
		loadChunk(0, 0, tiles);

		const world = new World({ seed: 99 });

		const player = world.create();
		world.add(player, Position, { x: 3, y: 4 });
		world.add(player, NamedIdentity, { name: 'Player', identity: 'player' });
		world.add(player, Faction, { key: 'player' });
		world.add(player, Vitality, { maxHp: 30, hp: 30 });

		const goblinA = world.create();
		world.add(goblinA, Position, { x: 5, y: 3 });
		world.add(goblinA, NamedIdentity, { name: 'Goblin A', identity: 'goblin' });
		world.add(goblinA, Faction, { key: 'enemy' });
		world.add(goblinA, Vitality, { maxHp: 20, hp: 20 });
		world.add(goblinA, ActiveEffects, { effects: [] });

		const goblinB = world.create();
		world.add(goblinB, Position, { x: 5, y: 5 });
		world.add(goblinB, NamedIdentity, { name: 'Goblin B', identity: 'goblin' });
		world.add(goblinB, Faction, { key: 'enemy' });
		world.add(goblinB, Vitality, { maxHp: 20, hp: 20 });
		world.add(goblinB, ActiveEffects, { effects: [] });

		world._goblinA = goblinA;
		world._goblinB = goblinB;

		const entities = new Map();
		entities.set(player,  { label: 'Player',   track: false });
		entities.set(goblinA, { label: 'Goblin A',  track: true });
		entities.set(goblinB, { label: 'Goblin B',  track: true });

		return { world, entities };
	},

	steps: [
		{
			description: 'Crit kill forks ✦ cataclysm_mark onto both nearby goblins.',
			run(world) {
				world.step += 1;
				for (const id of [world._goblinA, world._goblinB]) {
					const ae = world.get(id, ActiveEffects);
					ae.effects.push({ key: 'cataclysm_mark', turnsLeft: 4, potency: 1, stacks: 1 });
				}
			},
			check(world) {
				const marked = [world._goblinA, world._goblinB].filter(id => {
					const ae = world.get(id, ActiveEffects);
					return ae.effects.some(e => e.key === 'cataclysm_mark');
				});
				const pass = marked.length === 2;
				return { pass, message: pass ? 'Both goblins marked.' : `Only ${marked.length}/2 marked.` };
			},
		},
		{
			description: 'Hit Goblin A — mark consumed, detonation. Badge clears on A only; B still marked.',
			run(world) {
				world.step += 1;
				const ae = world.get(world._goblinA, ActiveEffects);
				ae.effects = ae.effects.filter(e => e.key !== 'cataclysm_mark');
			},
			check(world) {
				const aeA = world.get(world._goblinA, ActiveEffects);
				const aeB = world.get(world._goblinB, ActiveEffects);
				const aCleared = !aeA.effects.some(e => e.key === 'cataclysm_mark');
				const bStillMarked = aeB.effects.some(e => e.key === 'cataclysm_mark');
				const pass = aCleared && bStillMarked;
				return { pass, message: pass ? 'A detonated, B still marked.' : `aCleared=${aCleared} bStillMarked=${bStillMarked}` };
			},
		},
		{
			description: 'Hit Goblin B — last mark consumed. All badges cleared.',
			run(world) {
				world.step += 1;
				const ae = world.get(world._goblinB, ActiveEffects);
				ae.effects = ae.effects.filter(e => e.key !== 'cataclysm_mark');
			},
			check(world) {
				const allClear = [world._goblinA, world._goblinB].every(id => {
					const ae = world.get(id, ActiveEffects);
					return !ae.effects.some(e => e.key === 'cataclysm_mark');
				});
				return { pass: allClear, message: allClear ? 'All marks cleared.' : 'Some marks remain.' };
			},
		},
	],
};
