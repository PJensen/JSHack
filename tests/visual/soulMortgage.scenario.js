import { World } from '../../src/lib/ecs-js/index.js';
import { ActiveEffects } from '../../src/rules/components/ActiveEffects.js';
import { Faction } from '../../src/rules/components/Faction.js';
import { NamedIdentity } from '../../src/rules/components/NamedIdentity.js';
import { Position } from '../../src/rules/components/Position.js';
import { Vitality } from '../../src/rules/components/Vitality.js';
import { CHUNK_SIZE, TILE_FLOOR } from '../../src/rules/environment/dungeon/constants.js';
import { clearAll, loadChunk } from '../../src/rules/environment/dungeon/tileMap.js';

export default {
	name: 'Soul Mortgage',
	description: 'The ⚖️ badge appears above the player as soul debt accrues with each hit. Stack count grows — the reckoning approaches.',
	bounds: { x0: 2, y0: 3, x1: 8, y1: 5 },

	setup() {
		clearAll();
		const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
		loadChunk(0, 0, tiles);

		const world = new World({ seed: 13 });

		const player = world.create();
		world.add(player, Position, { x: 3, y: 4 });
		world.add(player, NamedIdentity, { name: 'Player', identity: 'player' });
		world.add(player, Faction, { key: 'player' });
		world.add(player, Vitality, { maxHp: 30, hp: 30 });
		world.add(player, ActiveEffects, { effects: [] });

		const goblin = world.create();
		world.add(goblin, Position, { x: 6, y: 4 });
		world.add(goblin, NamedIdentity, { name: 'Goblin', identity: 'goblin' });
		world.add(goblin, Faction, { key: 'enemy' });
		world.add(goblin, Vitality, { maxHp: 20, hp: 20 });

		world._playerId = player;

		const entities = new Map();
		entities.set(player, { label: 'Player', track: true });
		entities.set(goblin, { label: 'Goblin', track: false });

		return { world, entities };
	},

	steps: [
		{
			description: 'First hit — soul debt begins (×1). ⚖️ badge appears above the player.',
			run(world) {
				world.step += 1;
				const ae = world.get(world._playerId, ActiveEffects);
				ae.effects.push({ key: 'soul_mortgage_debt', turnsLeft: 99, potency: 1, stacks: 1 });
			},
			check(world) {
				const ae = world.get(world._playerId, ActiveEffects);
				const eff = ae.effects.find(e => e.key === 'soul_mortgage_debt');
				const pass = eff?.stacks === 1;
				return { pass, message: pass ? 'Debt ×1.' : `Expected stacks=1, got ${eff?.stacks}` };
			},
		},
		{
			description: 'More hits — debt grows to ×4. Stack counter increases on badge.',
			run(world) {
				world.step += 1;
				const ae = world.get(world._playerId, ActiveEffects);
				const eff = ae.effects.find(e => e.key === 'soul_mortgage_debt');
				if (eff) { eff.stacks = 4; eff.potency = 4; }
			},
			check(world) {
				const ae = world.get(world._playerId, ActiveEffects);
				const eff = ae.effects.find(e => e.key === 'soul_mortgage_debt');
				const pass = eff?.stacks === 4;
				return { pass, message: pass ? 'Debt ×4.' : `Expected stacks=4, got ${eff?.stacks}` };
			},
		},
		{
			description: 'Debt spirals to ×9. The reckoning looms.',
			run(world) {
				world.step += 1;
				const ae = world.get(world._playerId, ActiveEffects);
				const eff = ae.effects.find(e => e.key === 'soul_mortgage_debt');
				if (eff) { eff.stacks = 9; eff.potency = 9; }
			},
			check(world) {
				const ae = world.get(world._playerId, ActiveEffects);
				const eff = ae.effects.find(e => e.key === 'soul_mortgage_debt');
				const pass = eff?.stacks === 9;
				return { pass, message: pass ? 'Debt ×9.' : `Expected stacks=9, got ${eff?.stacks}` };
			},
		},
	],
};
