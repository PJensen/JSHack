import { World } from '../../src/lib/ecs-js/index.js';
import { ActiveEffects } from '../../src/rules/components/ActiveEffects.js';
import { Faction } from '../../src/rules/components/Faction.js';
import { NamedIdentity } from '../../src/rules/components/NamedIdentity.js';
import { Position } from '../../src/rules/components/Position.js';
import { Vitality } from '../../src/rules/components/Vitality.js';
import { CHUNK_SIZE, TILE_FLOOR } from '../../src/rules/environment/dungeon/constants.js';
import { clearAll, loadChunk } from '../../src/rules/environment/dungeon/tileMap.js';

export default {
	name: 'Doom Clock',
	description: 'The ⌛ proc badge builds from stack 1 → 2 above the goblin, then clears on detonation. Pulse rate accelerates with stacks.',
	bounds: { x0: 2, y0: 3, x1: 7, y1: 5 },

	setup() {
		clearAll();
		const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
		loadChunk(0, 0, tiles);

		const world = new World({ seed: 42 });

		const player = world.create();
		world.add(player, Position, { x: 3, y: 4 });
		world.add(player, NamedIdentity, { name: 'Player', identity: 'player' });
		world.add(player, Faction, { key: 'player' });
		world.add(player, Vitality, { maxHp: 30, hp: 30 });

		const goblin = world.create();
		world.add(goblin, Position, { x: 5, y: 4 });
		world.add(goblin, NamedIdentity, { name: 'Goblin', identity: 'goblin' });
		world.add(goblin, Faction, { key: 'enemy' });
		world.add(goblin, Vitality, { maxHp: 20, hp: 20 });
		world.add(goblin, ActiveEffects, { effects: [] });

		world._goblinId = goblin;

		const entities = new Map();
		entities.set(player, { label: 'Player', track: false });
		entities.set(goblin, { label: 'Goblin', track: true });

		return { world, entities };
	},

	steps: [
		{
			description: 'First toll — doom_clock stack 1. ⌛ badge appears above the goblin.',
			run(world) {
				world.step += 1;
				const ae = world.get(world._goblinId, ActiveEffects);
				ae.effects.push({ key: 'doom_clock', turnsLeft: 9, potency: 1, stacks: 1 });
			},
			check(world) {
				const ae = world.get(world._goblinId, ActiveEffects);
				const eff = ae.effects.find(e => e.key === 'doom_clock');
				const pass = eff?.stacks === 1;
				return { pass, message: pass ? 'Stack 1 active.' : `Expected stacks=1, got ${eff?.stacks}` };
			},
		},
		{
			description: 'Second toll — doom_clock stack 2. Badge pulses faster.',
			run(world) {
				world.step += 1;
				const ae = world.get(world._goblinId, ActiveEffects);
				const eff = ae.effects.find(e => e.key === 'doom_clock');
				if (eff) { eff.stacks = 2; eff.potency = 2; eff.turnsLeft = 9; }
			},
			check(world) {
				const ae = world.get(world._goblinId, ActiveEffects);
				const eff = ae.effects.find(e => e.key === 'doom_clock');
				const pass = eff?.stacks === 2;
				return { pass, message: pass ? 'Stack 2 active — faster pulse.' : `Expected stacks=2, got ${eff?.stacks}` };
			},
		},
		{
			description: 'Clock tolls — detonation. Badge removed.',
			run(world) {
				world.step += 1;
				const ae = world.get(world._goblinId, ActiveEffects);
				ae.effects = ae.effects.filter(e => e.key !== 'doom_clock');
			},
			check(world) {
				const ae = world.get(world._goblinId, ActiveEffects);
				const eff = ae.effects.find(e => e.key === 'doom_clock');
				const pass = !eff;
				return { pass, message: pass ? 'doom_clock cleared.' : 'Effect still present after detonation.' };
			},
		},
	],
};
