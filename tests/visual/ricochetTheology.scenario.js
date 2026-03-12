import { World } from '../../src/lib/ecs-js/index.js';
import { ActiveEffects } from '../../src/rules/components/ActiveEffects.js';
import { Faction } from '../../src/rules/components/Faction.js';
import { NamedIdentity } from '../../src/rules/components/NamedIdentity.js';
import { Position } from '../../src/rules/components/Position.js';
import { Vitality } from '../../src/rules/components/Vitality.js';
import { PROC_PACKAGE_KEYS } from '../../src/rules/data/procPackages.js';
import { CHUNK_SIZE, TILE_FLOOR, TILE_WALL } from '../../src/rules/environment/dungeon/constants.js';
import { clearAll, loadChunk, setTile } from '../../src/rules/environment/dungeon/tileMap.js';
import { ScriptVerb, runScript } from '../../src/rules/scripting.js';
import { effectSystem } from '../../src/rules/systems/effectSystem.js';
import { applyProcAccumulator } from '../../src/rules/utils/procApplication.js';
import { dealDamage } from '../../src/rules/utils/dealDamage.js';

function createProcHarness(world) {
	const out = {
		bonusDamage: [],
		bonusCritChance: 0,
		statusesToApply: [],
		buffsToAttach: [],
		resourcesToRestore: [],
		vitalityToRestore: [],
		directDamage: [],
		spawnedEntities: [],
		chargesToConsume: [],
		cancelled: false,
		messages: [],
	};

	return {
		source: world._attackerId,
		target: world._defenderId,
		kind: 'onHit',
		damage: { amount: 10, type: 'pierce', crit: false, blocked: false },
		tags: new Set(['ranged', 'projectile', 'wallRicochet']),
		proc: {
			addBonusDamage(min, max = min, type = 'physical') {
				out.bonusDamage.push({ source: 0, min, max, type });
			},
			addCritChance(amount) {
				out.bonusCritChance += Number(amount || 0);
			},
			restoreResource(target, resource, amount) {
				out.resourcesToRestore.push({ source: 0, target, resource, amount });
			},
			applyStatus(target, key, turnsLeft, potency = 1) {
				out.statusesToApply.push({
					source: 0,
					target,
					status: { key, turnsLeft, potency },
				});
			},
			attachTimedBuff(target, buff, duration) {
				out.buffsToAttach.push({ source: 0, target, buff, duration });
			},
			spawnEntity(kind, count = 1, anchor = 'target') {
				out.spawnedEntities.push({ source: 0, kind, count, anchor });
			},
			consumeCharge(entityId, amount = 1) {
				out.chargesToConsume.push({ source: 0, entityId, amount });
			},
			heal(target, amount) {
				out.vitalityToRestore.push({ source: 0, target, amount });
			},
			dealDamage(target, amount, type = 'physical', options = {}) {
				out.directDamage.push({
					source: Number(options.source || world._attackerId || 0) | 0,
					target: Number(target || 0) | 0,
					amount: Number(amount || 0),
					type: String(type || 'physical'),
					cause: String(options.cause || 'proc'),
					bypassResist: !!options.bypassResist,
					bypassInvuln: !!options.bypassInvuln,
					noTrigger: !!options.noTrigger,
					nonLethal: !!options.nonLethal,
				});
			},
			cancel() {
				out.cancelled = true;
			},
			message(text) {
				out.messages.push({ source: 0, text: String(text || '') });
			},
			emit(name, payload = {}) {
				world.emit?.(String(name || ''), payload);
			},
		},
		out,
	};
}

function trackedEffectKeys(world, ids) {
	return ids.flatMap((id) => {
		const activeEffects = world.get(id, ActiveEffects);
		if (!Array.isArray(activeEffects?.effects)) return [];
		return activeEffects.effects.map((entry) => `${id}:${entry.key}`);
	});
}

export default {
	name: 'Ricochet Theology',
	description: 'A wall-adjacent projectile hit rebounds into two nearby enemies, emits visible rebound projectiles, and resolves its electric damage immediately without leaving delayed shock ticks.',
	bounds: { x0: 1, y0: 1, x1: 8, y1: 7 },

	setup() {
		clearAll();
		const tiles = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE).fill(TILE_FLOOR);
		loadChunk(0, 0, tiles);
		setTile(4, 3, TILE_WALL);

		const world = new World({ seed: 13 });
		world._projectileEvents = [];
		world.on('projectile:spawn', (payload) => {
			world._projectileEvents.push(payload);
		});

		const attacker = world.create();
		world.add(attacker, Position, { x: 2, y: 4 });
		world.add(attacker, NamedIdentity, { name: 'Archer', identity: 'player' });
		world.add(attacker, Faction, { key: 'player' });
		world.add(attacker, Vitality, { maxHp: 20, hp: 20 });

		const defender = world.create();
		world.add(defender, Position, { x: 4, y: 4 });
		world.add(defender, NamedIdentity, { name: 'Anchor', identity: 'goblin' });
		world.add(defender, Faction, { key: 'enemy' });
		world.add(defender, Vitality, { maxHp: 20, hp: 20 });

		const bystanderA = world.create();
		world.add(bystanderA, Position, { x: 5, y: 4 });
		world.add(bystanderA, NamedIdentity, { name: 'North Bystander', identity: 'kobold' });
		world.add(bystanderA, Faction, { key: 'enemy' });
		world.add(bystanderA, Vitality, { maxHp: 20, hp: 20 });
		world.add(bystanderA, ActiveEffects, { effects: [] });

		const bystanderB = world.create();
		world.add(bystanderB, Position, { x: 5, y: 5 });
		world.add(bystanderB, NamedIdentity, { name: 'South Bystander', identity: 'kobold' });
		world.add(bystanderB, Faction, { key: 'enemy' });
		world.add(bystanderB, Vitality, { maxHp: 20, hp: 20 });
		world.add(bystanderB, ActiveEffects, { effects: [] });

		world._attackerId = attacker;
		world._defenderId = defender;
		world._bystanderIds = [bystanderA, bystanderB];

		const entities = new Map();
		entities.set(attacker, { label: 'Attacker', track: true });
		entities.set(defender, { label: 'Primary Target', track: true });
		entities.set(bystanderA, { label: 'Bounce A', track: true });
		entities.set(bystanderB, { label: 'Bounce B', track: true });

		return { world, entities };
	},

	steps: [
		{
			description: 'Trigger a wall-adjacent ricochet hit and apply the proc output immediately.',
			run(world) {
				world.step += 1;
				world._projectileEvents.length = 0;
				const harness = createProcHarness(world);
				runScript(PROC_PACKAGE_KEYS.RicochetTheology, ScriptVerb.ProcEvaluate, world, harness);
				applyProcAccumulator(world, harness.out, { applyDamage: dealDamage });
			},
			check(world) {
				const hits = world._bystanderIds.map((id) => world.get(id, Vitality)?.hp ?? 0);
				const eventCount = world._projectileEvents.length;
				const lingering = trackedEffectKeys(world, world._bystanderIds);
				const pass = eventCount === 2 && hits.every((hp) => hp === 16) && lingering.length === 0;
				return {
					pass,
					message: pass
						? 'Two rebound projectiles spawned and both nearby enemies took immediate electric damage.'
						: `expected 2 rebounds and immediate damage; saw events=${eventCount}, hp=${hits.join(',')}, lingering=${lingering.join(',') || 'none'}`,
				};
			},
		},
		{
			description: 'Advance one effects tick to confirm no delayed shock damage appears.',
			run(world) {
				world.step += 1;
				effectSystem(world);
			},
			check(world) {
				const hits = world._bystanderIds.map((id) => world.get(id, Vitality)?.hp ?? 0);
				const lingering = trackedEffectKeys(world, world._bystanderIds);
				const pass = hits.every((hp) => hp === 16) && lingering.length === 0;
				return {
					pass,
					message: pass
						? 'No delayed shock tick after the first follow-up turn.'
						: `unexpected delayed effect after one turn; hp=${hits.join(',')}, lingering=${lingering.join(',') || 'none'}`,
				};
			},
		},
		{
			description: 'Advance a second effects tick to confirm the ricochet stays immediate-only.',
			run(world) {
				world.step += 1;
				effectSystem(world);
			},
			check(world) {
				const hits = world._bystanderIds.map((id) => world.get(id, Vitality)?.hp ?? 0);
				const lingering = trackedEffectKeys(world, world._bystanderIds);
				const pass = hits.every((hp) => hp === 16) && lingering.length === 0;
				return {
					pass,
					message: pass
						? 'Ricochet Theology stayed clean across two later turns.'
						: `unexpected later tick; hp=${hits.join(',')}, lingering=${lingering.join(',') || 'none'}`,
				};
			},
		},
	],
};
