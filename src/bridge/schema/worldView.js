// bridge/schema/worldView.js
// Build a minimal, stable WorldView DTO for display.

import { Position } from "../../rules/components/Position.js";
import { Player } from "../../rules/components/Player.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { DoorState } from "../../rules/components/DoorState.js";
import { Collider } from "../../rules/components/Collider.js";
import { Status } from "../../rules/components/Status.js";
import { Equipment } from "../../rules/components/Equipment.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";
import { ObjectState } from "../../rules/components/ObjectState.js";
import { getTile, forEachTileInRect, forEachLoadedTile, isRoofed } from '../../rules/environment/dungeon/tileMap.js';
import { TILE_DOOR, TILE_FLOOR, TILE_WALL } from "../../rules/environment/dungeon/constants.js";
import { buildBlocksVisionMap, blockedCallback } from '../../rules/utils/vision.js';
import { updateFOV, isVisible, isExplored } from '../../rules/environment/dungeon/exploredMap.js';
import { forEachInRect, ensureSpatialIndex } from '../../rules/utils/spatialIndex.js';
import { Engraving } from '../../rules/components/Engraving.js';
import { PlasmaCloud } from "../../rules/components/PlasmaCloud.js";
import { HazardArea } from "../../rules/components/HazardArea.js";
import { Trap } from "../../rules/components/Trap.js";
import { Vitality } from '../../rules/components/Vitality.js';
import { Faction } from '../../rules/components/Faction.js';
import { Pet } from '../../rules/components/Pet.js';
import { areFactionsHostile } from '../../rules/utils/factionHostility.js';
import { effectiveMaxHp } from '../../rules/utils/passiveBonuses.js';
import { getMonsterTags } from '../../rules/data/monsters.js';
import { Flying } from '../../rules/components/Flying.js';
import { hasOverworldAerialLOS } from '../../rules/utils/flyingEligibility.js';
import { DungeonState } from "../../rules/components/DungeonState.js";
import { TURNS_PER_DAY, PHASE_BOUNDS } from "../../rules/data/calendar.js";
import { QuestBindings } from "../../rules/components/QuestBindings.js";
import { QuestState } from "../../rules/components/QuestState.js";
import { WeatherState } from "../../rules/components/WeatherState.js";
import { Burned } from "../../rules/components/Burned.js";
import { getDestroyedTileLedger } from "../../rules/utils/destroyedTiles.js";
import { getEffectiveVisionRange } from "../../rules/utils/blind.js";
import { ActiveEffects } from "../../rules/components/ActiveEffects.js";
import { DistrictProfile } from "../../rules/components/DistrictProfile.js";
import { EntranceProfile } from "../../rules/components/EntranceProfile.js";
import { GroundStackOrder } from "../../rules/components/GroundStackOrder.js";
import { Facing } from "../../rules/components/Facing.js";
import { canonicalStatusKey } from "../../rules/utils/effectSemantics.js";
import { listProcPackages } from "../../rules/data/procPackages.js";
import { getEntityFacingConeDegrees, getNormalizedEntityFacing, isPointInFacingCone, perceptionToFacingConeDegrees } from "../../rules/utils/facing.js";
import { readPlayerPerceptionState } from "../../rules/utils/perceptionState.js";
import { chebyshevDistance, hasMindForEsp, isFixedDecorationEntity, isPerceptionMonster } from "../../rules/utils/perceptionChannels.js";
import { PERCEPTION_TUNING } from "../../rules/environment/dungeon/perceptionTuning.js";
import { BaseStats } from "../../rules/components/BaseStats.js";
import {
	clearPerceptionMemory,
	listPerceptionKinds,
	projectPerceptionContact,
	rememberPerceptionContact,
} from "../../rules/environment/dungeon/perceptionMemory.js";

// Reuse view/record objects across frames to reduce allocations/GC churn.
/** @typedef {{ id:number, kind:string, pos:{x:number,y:number}, tags:string[], layer:number, hp:number, maxHp:number, isPet:boolean, showHealthBar:boolean, facing:{dx:number,dy:number}|null }} EntityView */
/** @typedef {{ id:number, x:number, y:number }} SolidView */
/** @typedef {{ x:number, y:number, kind:string, alpha:number, burning?:boolean, smoking?:boolean }} RoofTileView */
/** @typedef {{ turn:number, seed:number, player: { id:number, pos:{x:number,y:number} } | null, entities: EntityView[], solids: SolidView[], emissives: any[], roofs: RoofTileView[], tileGrid: any, isVisible: ((x:number,y:number)=>boolean)|null, isExplored: ((x:number,y:number)=>boolean)|null }} WorldView */

/** @typedef {{ id:number, text:string, profane:boolean, pos:{x:number,y:number} }} EngravingView */

/** @type {WorldView} */
const _view = { turn: 0, seed: 0, player: null, entities: [], solids: [], emissives: [], roofs: [], engravings: [], tileGrid: null, isVisible: null, isExplored: null, weather: "clear", playerSheltered: false, nightAlpha: 0, dawnAlpha: 0, duskAlpha: 0 };
let _lastPerceptionWorld = null;
/** @type {Map<number, EntityView>} */
const _entityRecs = new Map();   // id -> { id, kind, pos:{x,y}, tags:[] }
const _questGiverIds = new Set(); // entity IDs that are active quest givers
/** @type {Map<number, SolidView>} */
const _solidRecs = new Map();    // id -> { id, x, y }

const DISPLAY_STATUS_TAGS = new Set([
	'invulnerable',
	'stunned',
	'poisoned',
	'burning',
	'regen',
	'thorns',
	'disease',
	'bleeding',
	'shocked',
	'frozen',
	'confused',
	'weakened',
	'cursed',
	'blessed',
	'mindwiped',
	'stoneskin',
	'energized',
	'taunted',
	'hallucinating',
	'intoxicated',
	'satiated',
	'peckish',
	'hungry',
	'famished',
	'starving',
	'wasting',
	'agony',
	'blinded',
	'invisible',
	'phase_shift',
	'shadow_cloak',
	'resist_fire',
	'resist_poison',
	'resist_electric',
	'resist_acid',
]);
const PROC_STATE_INFO_BY_KEY = (() => {
	/** @type {Map<string, {name:string, description:string}>} */
	const out = new Map();
	const specs = listProcPackages();
	for (const spec of specs) {
		const stateKeys = Array.isArray(spec?.stateKeys) ? spec.stateKeys : [];
		for (const stateKey of stateKeys) {
			const key = String(stateKey || "").trim();
			if (!key || out.has(key)) continue;
			out.set(key, {
				name: String(spec?.name || key),
				description: String(spec?.summary || "").trim(),
			});
		}
	}
	return out;
})();

// Proc state effect keys that should be projected onto entity views for proc glyph affordance.
const ENTITY_PROC_STATE_KEYS = new Set(PROC_STATE_INFO_BY_KEY.keys());

const VENOM_GLOW_ITEM_KINDS = new Set(['nightfang_dagger', 'venomfang_dagger', 'nightfang', 'venomfang']);
const POTION_GLOW_DISABLED_KINDS = new Set();

/** @type {EntityView[]} reusable temp buffer for entity collection before FOV filter */
const _allEntities = [];
function xyKey(x, y) {
	return `${x},${y}`;
}

function keyToXY(key) {
	const [x, y] = key.split(",").map(Number);
	return { x, y };
}

const CARDINAL_STEPS = Object.freeze([
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1],
]);
/** How many turns after burning a tile still smolders (emits smoke). */
const SMOLDER_TURNS = 30;
const MEMORY_TTL_TURNS = PERCEPTION_TUNING.memoryTtlTurns;
const THERMAL_BASE_RANGE = PERCEPTION_TUNING.thermalBaseRange;
const ESP_BASE_RANGE = PERCEPTION_TUNING.espBaseRange;
const TOUCH_RESOLVE_RANGE = PERCEPTION_TUNING.touchResolveRange;

/**
 * @param {EntityView} src
 * @param {string[]} extraTags
 * @param {{ x:number, y:number }} at
 * @param {string} [kindOverride]
 * @returns {EntityView}
 */
function makePerceptionEcho(src, extraTags, at, kindOverride = undefined) {
	const tags = [];
	for (let i = 0; i < extraTags.length; i++) {
		if (!tags.includes(extraTags[i])) tags.push(extraTags[i]);
	}
	return {
		id: src.id,
		kind: kindOverride || src.kind,
		pos: { x: at.x | 0, y: at.y | 0 },
		tags,
		layer: Number(src.layer || 300) | 0,
		hp: 0,
		maxHp: 0,
		isPet: false,
		showHealthBar: false,
		facing: null,
	};
}

function isRoofBearingTile(tile) {
	return tile === TILE_FLOOR || tile === TILE_WALL || tile === TILE_DOOR;
}

/**
 * @param {string} key
 * @param {Set<string>} candidates
 * @param {number} radius
 */
function keyWithinRadius(key, candidates, radius = 1) {
	if (!candidates?.size) return false;
	const { x, y } = keyToXY(key);
	for (let dy = -radius; dy <= radius; dy++) {
		for (let dx = -radius; dx <= radius; dx++) {
			if (candidates.has(xyKey(x + dx, y + dy))) return true;
		}
	}
	return false;
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {{ x:number, y:number } | null} playerPos
 */
function collectOverworldRoofs(world, playerPos) {
	let isOverworld = false;
	for (const [, ds] of world.query(DungeonState)) {
		isOverworld = ds.currentDepth === 0 || ds.profileType === "overworld";
		break;
	}
	if (!isOverworld) return [];

	const destroyedTiles = getDestroyedTileLedger(world);
	const activeFireKeys = new Set();
	for (const [, pos, hazard] of world.query(Position, HazardArea)) {
		if (!pos || !hazard) continue;
		if (String(hazard.kind || "").toLowerCase() !== "fire") continue;
		if (String(hazard.medium || "air").toLowerCase() !== "floor") continue;
		activeFireKeys.add(xyKey(pos.x, pos.y));
	}
	const playerKey = playerPos ? xyKey(playerPos.x, playerPos.y) : "";
	const roofs = [];
	const destroyedTileKeys = new Set();
	const smolderingRoofKeys = new Set();
	for (const [key, rec] of Object.entries(destroyedTiles || {})) {
		destroyedTileKeys.add(key);
		const age = Math.max(1, (_view.turn | 0) - (Number(rec?.destroyedAtTurn || 0) | 0) + 1);
		if (age <= SMOLDER_TURNS) {
			smolderingRoofKeys.add(key);
		}
	}

	if (playerPos) {
		const bitmapKeys = new Set();
		forEachLoadedTile((x, y) => {
			if (isRoofed(x, y)) bitmapKeys.add(xyKey(x, y));
		});
		const bitmapUsed = new Set();
		for (const startKey of bitmapKeys) {
			if (bitmapUsed.has(startKey)) continue;
			const comp = new Set();
			const q = [startKey];
			comp.add(startKey);
			for (let i = 0; i < q.length; i++) {
				const { x, y } = keyToXY(q[i]);
				for (let j = 0; j < CARDINAL_STEPS.length; j++) {
					const nk = xyKey(x + CARDINAL_STEPS[j][0], y + CARDINAL_STEPS[j][1]);
					if (!comp.has(nk) && bitmapKeys.has(nk)) { comp.add(nk); q.push(nk); }
				}
			}
			for (const k of comp) bitmapUsed.add(k);

			const renderKeys = [];
			let minY = Infinity;
			let maxY = -Infinity;
			for (const key of comp) {
				const { x, y } = keyToXY(key);
				if (!isRoofBearingTile(getTile(x, y))) continue;
				renderKeys.push(key);
				if (y < minY) minY = y;
				if (y > maxY) maxY = y;
			}
			if (!renderKeys.length) continue;

			if (playerKey && comp.has(playerKey)) {
				const playerTile = getTile(playerPos.x, playerPos.y);
				const nearDestroyed = keyWithinRadius(playerKey, destroyedTileKeys, 1);
				const nearFire = keyWithinRadius(playerKey, activeFireKeys, 1);
				_view.playerSheltered = isRoofBearingTile(playerTile) && !nearDestroyed && !nearFire;
				continue;
			}

			const shadowCutoff = minY + Math.floor((maxY - minY) * 0.5);

			for (const key of renderKeys) {
				const { x, y } = keyToXY(key);
				const tile = getTile(x, y);
				const destroyedHere = destroyedTileKeys.has(key);
				const nearFire = keyWithinRadius(key, activeFireKeys, 1);
				const singed = keyWithinRadius(key, destroyedTileKeys, 1);
				if (tile === TILE_FLOOR) {
					let exposed = false;
					let adjacentDestroyed = false;
					for (let j = 0; j < CARDINAL_STEPS.length; j++) {
						const nx = x + CARDINAL_STEPS[j][0];
						const ny = y + CARDINAL_STEPS[j][1];
						if (destroyedTileKeys.has(xyKey(nx, ny))) adjacentDestroyed = true;
						if (!comp.has(xyKey(nx, ny))) continue;
						if (!isRoofBearingTile(getTile(nx, ny))) {
							exposed = true;
							break;
						}
					}
					if (exposed || ((destroyedHere || adjacentDestroyed) && !nearFire)) continue;
				}
				const isDoor = tile === TILE_DOOR;
				let kind = y <= shadowCutoff ? "roof_thatch_shadow" : "roof_thatch_lit";
				let alpha = isDoor ? 0.4 : 1.0;
				let burning = false;
				let smoking = false;
				if (singed) {
					kind += "_charred";
					if (nearFire) {
						burning = true;
					} else {
						alpha *= 0.45;
						smoking = keyWithinRadius(key, smolderingRoofKeys, 1);
					}
				} else if (nearFire) {
					burning = true;
				}
				roofs.push({ x, y, kind, alpha, burning, smoking });
			}
		}
	}

	return roofs;
}

/**
 * @param {string} rawType
 */
function normalizeDisplayStatusType(rawType) {
	const type = String(rawType || '').toLowerCase();
	switch (type) {
		case 'poison': return 'poisoned';
		case 'burn': return 'burning';
		case 'bleed': return 'bleeding';
		case 'shock': return 'shocked';
		case 'frost': return 'frozen';
		case 'confuse': return 'confused';
		case 'bless': return 'blessed';
		case 'curse': return 'cursed';
		default: return type;
	}
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} id
 * @param {EntityView} rec
 */
function projectDisplayTags(world, id, rec) {
	/** @type {any} */ const stat = /** @type any */ (world.get(id, Status));
	if (stat && Array.isArray(stat.statuses)) {
		for (let i = 0; i < stat.statuses.length; i++) {
			const s = stat.statuses[i];
			const t = normalizeDisplayStatusType(s?.type);
			if (!t || !DISPLAY_STATUS_TAGS.has(t)) continue;
			if (!rec.tags.includes(t)) rec.tags.push(t);
		}
	}

	/** @type {any} */ const ae = /** @type any */ (world.get(id, ActiveEffects));
	if (!ae || !Array.isArray(ae.effects)) return;
	for (let i = 0; i < ae.effects.length; i++) {
		const e = ae.effects[i];
		if (!e || (Number(e.turnsLeft || 0) | 0) <= 0) continue;
		if ((Number(e.onsetLeft || 0) | 0) > 0) continue;
		const t = normalizeDisplayStatusType(canonicalStatusKey(e.key));
		if (!t || !DISPLAY_STATUS_TAGS.has(t)) continue;
		if (!rec.tags.includes(t)) rec.tags.push(t);
	}
}

/**
 * Project display-relevant tags from equipped items carried by an entity.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} id
 * @param {EntityView} rec
 */
function projectEquipmentDisplayTags(world, id, rec) {
	/** @type {any} */ const eq = /** @type any */ (world.get(id, Equipment));
	if (!eq) return;
	const offhandId = Number(eq.offhand || 0) | 0;
	if (!(offhandId > 0)) return;
	const offhandIdentity = String(world.get(offhandId, NamedIdentity)?.identity || "").toLowerCase();
	if (offhandIdentity === "torch" && !rec.tags.includes("torch")) {
		rec.tags.push("torch");
	}
}

/**
 * Project display-relevant tags from the monster definition onto the entity record.
 * @param {string} kind - entity identity (matches monster id)
 * @param {EntityView} rec
 */
function projectMonsterDefTags(kind, rec) {
	const defTags = getMonsterTags(kind);
	for (let i = 0; i < defTags.length; i++) {
		const t = defTags[i];
		if (!rec.tags.includes(t)) rec.tags.push(t);
	}
}

/**
 * @param {string} kind
 * @param {any} itemInfo
 * @param {EntityView} rec
 */
function projectItemAffixDisplayTags(kind, itemInfo, rec) {
	if (itemInfo && String(itemInfo.type || '').toLowerCase() === 'potion' && !POTION_GLOW_DISABLED_KINDS.has(String(kind || ''))) {
		if (!rec.tags.includes('potion_glow')) rec.tags.push('potion_glow');
	}
	if (!itemInfo || !Array.isArray(itemInfo.affixes)) return;
	const affixes = itemInfo.affixes;
	const hasAffix = (key) => affixes.includes(key) || affixes.includes(`affix:${key}`);

	if ((hasAffix('flaming') || hasAffix('firestorm1')) && !rec.tags.includes('glowing')) {
		rec.tags.push('glowing');
	}
	if (hasAffix('venomous1') || VENOM_GLOW_ITEM_KINDS.has(String(kind || ''))) {
		if (!rec.tags.includes('venom_glowing')) rec.tags.push('venom_glowing');
	}
	if ((hasAffix('chainLightning1') || hasAffix('capacitive1')) && !rec.tags.includes('storm_glowing')) {
		rec.tags.push('storm_glowing');
	}
	if (hasAffix('frostbite1') && !rec.tags.includes('frost_glowing')) {
		rec.tags.push('frost_glowing');
	}
	if (hasAffix('soulDrain1') && !rec.tags.includes('soul_glowing')) {
		rec.tags.push('soul_glowing');
	}
	if ((hasAffix('hemorrhage1') || hasAffix('berserk1')) && !rec.tags.includes('blood_glowing')) {
		rec.tags.push('blood_glowing');
	}
	if (hasAffix('caustic1') && !rec.tags.includes('caustic_glowing')) {
		rec.tags.push('caustic_glowing');
	}

	// Rarity-based glow fallback — only if no specialized glow already present
	const rn = String(itemInfo.rarityName || '').toLowerCase();
	if (rn === 'legendary' || rn === 'epic' || rn === 'rare') {
		const hasSpecialGlow = rec.tags.includes('glowing') || rec.tags.includes('venom_glowing') ||
			rec.tags.includes('frost_glowing') || rec.tags.includes('storm_glowing') ||
			rec.tags.includes('soul_glowing') || rec.tags.includes('blood_glowing') ||
			rec.tags.includes('caustic_glowing') || rec.tags.includes('potion_glow');
		if (!hasSpecialGlow) {
			if (rn === 'legendary' && !rec.tags.includes('legendary_glowing')) rec.tags.push('legendary_glowing');
			else if (rn === 'epic' && !rec.tags.includes('epic_glowing')) rec.tags.push('epic_glowing');
			else if (rn === 'rare' && !rec.tags.includes('rare_glowing')) rec.tags.push('rare_glowing');
		}
	}
}

/**
 * Project display-only combat HUD data onto the entity record.
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} id
 * @param {EntityView} rec
 * @param {string} playerFactionKey
 */
function projectCombatUi(world, id, rec, playerFactionKey) {
	rec.hp = 0;
	rec.maxHp = 0;
	rec.isPet = false;
	rec.showHealthBar = false;

	/** @type {any} */ const vit = /** @type any */ (world.get(id, Vitality));
	if (!vit) return;

	const maxHp = Math.max(1, effectiveMaxHp(world, id, vit));
	const hp = Math.max(0, Math.min(maxHp, vit.hp | 0));
	rec.hp = hp;
	rec.maxHp = maxHp;

	const factionKey = String(world.get(id, Faction)?.key || '').trim().toLowerCase();
	const isPet = world.has(id, Pet) || factionKey === 'pet';
	rec.isPet = isPet;
	if (isPet) {
		rec.showHealthBar = true;
		return;
	}
	if (!playerFactionKey || !factionKey) return;
	rec.showHealthBar = areFactionsHostile(playerFactionKey, factionKey);
}

/** Populate rec.procStates with any active proc state effects on the entity (enemy-side). */
function projectProcStateTags(world, id, rec) {
	const ae = /** @type any */ (world.get(id, ActiveEffects));
	if (!ae || !Array.isArray(ae.effects)) return;
	for (const e of ae.effects) {
		const key = String(e?.key || '');
		if (!ENTITY_PROC_STATE_KEYS.has(key)) continue;
		const stacks = Math.max(1, Number(e?.stacks || 1));
		const turnsLeft = Math.max(0, Number(e?.turnsLeft || 0) | 0);
		const potency = Number.isFinite(Number(e?.potency)) ? Number(e?.potency) : 1;
		const info = PROC_STATE_INFO_BY_KEY.get(key);
		if (!rec.procStates) rec.procStates = [];
		rec.procStates.push({
			key,
			stacks,
			turnsLeft,
			potency,
			name: String(info?.name || ""),
			description: String(info?.description || ""),
		});
	}
}

/**
 * Project actor-facing for display-only overlays (directional marker, etc.).
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @param {number} id
 * @param {EntityView} rec
 */
function projectFacing(world, id, rec) {
	const f = /** @type any */ (world.get(id, Facing));
	if (!f) {
		rec.facing = null;
		return;
	}
	const dx = Math.sign(Number(f.dx || 0));
	const dy = Math.sign(Number(f.dy || 0));
	rec.facing = (dx === 0 && dy === 0) ? null : { dx, dy };
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @returns {WorldView}
 */
export function buildWorldView(world) {
	if (_lastPerceptionWorld !== world) {
		clearPerceptionMemory();
		_lastPerceptionWorld = world;
	}
	_view.turn = world.step | 0;
	_view.seed = world.seed >>> 0;
	_view.player = null;
	_view.entities.length = 0;
	_view.solids.length = 0;
	_view.emissives.length = 0;
	_view.roofs.length = 0;
	_view.engravings.length = 0;
	_view.weather = "clear";
	_view.playerSheltered = false;
	_allEntities.length = 0;
	const collectedIds = new Set();

	// Read weather state (singleton on overworld)
	let _isOverworld = false;
	let currentDepth = 0;
	for (const [, ds] of world.query(DungeonState)) {
		currentDepth = Number(ds.currentDepth || 0) | 0;
		_isOverworld = (ds.currentDepth === 0 || ds.profileType === "overworld");
		break;
	}
	for (const [, ws] of world.query(WeatherState)) {
		_view.weather = ws.current || "clear";
		break;
	}

	// Compute night darkness (overworld only, derived from PHASE_BOUNDS)
	// sleep→dark, breakfast→dawn, work→bright, pub→dusk, home→dark
	_view.nightAlpha = 0;
	_view.dawnAlpha  = 0;
	_view.duskAlpha  = 0;
	if (_isOverworld) {
		const turnInDay = world.step % TURNS_PER_DAY;
		const breakfast = PHASE_BOUNDS[1]; // dawn transition
		const pub       = PHASE_BOUNDS[3]; // dusk transition
		if (turnInDay < breakfast.start || turnInDay >= pub.end) {
			_view.nightAlpha = 1;
		} else if (turnInDay < breakfast.end) {
			_view.nightAlpha = 1 - (turnInDay - breakfast.start) / (breakfast.end - breakfast.start);
			// Warm golden tint peaks at mid-dawn
			const t = (turnInDay - breakfast.start) / (breakfast.end - breakfast.start);
			_view.dawnAlpha = Math.sin(Math.PI * t);
		} else if (turnInDay < pub.start) {
			_view.nightAlpha = 0;
		} else {
			_view.nightAlpha = (turnInDay - pub.start) / (pub.end - pub.start);
			// Warm orange-red tint peaks at mid-dusk
			const t = (turnInDay - pub.start) / (pub.end - pub.start);
			_view.duskAlpha = Math.sin(Math.PI * t);
		}
	}

	// Collect active quest giver entity IDs for display tag projection.
	_questGiverIds.clear();
	for (const [, state, bind] of world.query(QuestState, QuestBindings)) {
		if (state.status === 'active' && bind.giver > 0) _questGiverIds.add(bind.giver);
	}

	// Expose tile grid functions for direct grid-based rendering
	_view.tileGrid = { getTile, forEachTileInRect };
	let playerVisionRadius = 0;

	for (const [id, _p, pos] of world.query(Player, Position)) {
		_view.player = { id, pos: { x: pos.x, y: pos.y } };
		break;
	}

	// Compute FOV (once per turn, idempotent via step check in updateFOV)
	if (_view.player) {
		const radius = getEffectiveVisionRange(world, _view.player.id);
		playerVisionRadius = radius;
		const facing = getNormalizedEntityFacing(world, _view.player.id);
		const coneDegrees = getEntityFacingConeDegrees(world, _view.player.id);
		const pad = 2;
		const bounds = {
			x0: _view.player.pos.x - radius - pad,
			y0: _view.player.pos.y - radius - pad,
			x1: _view.player.pos.x + radius + pad,
			y1: _view.player.pos.y + radius + pad,
		};
		const blockedMap = buildBlocksVisionMap(world, bounds);
		const isBlocked = blockedCallback(blockedMap);
		updateFOV(_view.turn, _view.player.pos.x, _view.player.pos.y, radius, isBlocked, {
			facingDx: facing?.dx || 0,
			facingDy: facing?.dy || 0,
			coneDegrees,
		});
	}

	_view.isVisible = isVisible;
	_view.isExplored = isExplored;
	const playerFactionKey = _view.player ? String(world.get(_view.player.id, Faction)?.key || "player").trim().toLowerCase() : "";
	const perceptionState = _view.player
		? readPlayerPerceptionState(world, _view.player.id)
		: { thermalSense: 0, espSense: 0, memoryTamper: 0 };
	const thermalSenseStrength = perceptionState.thermalSense;
	const espSenseStrength = perceptionState.espSense;
	const memoryTamperStrength = perceptionState.memoryTamper;
	const playerFacingForAwareness = _view.player
		? getNormalizedEntityFacing(world, _view.player.id)
		: null;
	const awarenessConeDegrees = _view.player
		? (() => {
			const stats = world.get(_view.player.id, BaseStats);
			return perceptionToFacingConeDegrees(Number(stats?.perception ?? 5));
		})()
		: 360;

	// Collect entity records near the player (or all if no player).
	if (_view.player) {
		ensureSpatialIndex(world);
		const radius = getEffectiveVisionRange(world, _view.player.id);
		playerVisionRadius = radius;
		const thermalRange = thermalSenseStrength > 0
			? (Math.max(radius, THERMAL_BASE_RANGE) + Math.min(6, (thermalSenseStrength | 0) * 2))
			: 0;
		const espRange = espSenseStrength > 0
			? (Math.max(radius, ESP_BASE_RANGE) + 6)
			: 0;
		const viewR = Math.max(radius | 0, thermalRange | 0, espRange | 0) + 4;
		const x0 = _view.player.pos.x - viewR;
		const y0 = _view.player.pos.y - viewR;
		const x1 = _view.player.pos.x + viewR;
		const y1 = _view.player.pos.y + viewR;
		forEachInRect(world, x0, y0, x1, y1, (id, pos) => {
			if (world.has(id, PlasmaCloud) || world.has(id, HazardArea)) return;
			if (world.has(id, Burned)) return;
			if (world.has(id, DistrictProfile) || world.has(id, EntranceProfile)) return;
			// Hide unrevealed traps — completely invisible until triggered
			/** @type {any} */ const trap = /** @type any */ (world.get(id, Trap));
			if (trap && !trap.revealed) return;
			const isPlayer = _view.player && id === _view.player.id;
			/** @type {any} */ const ident = /** @type any */ (world.get(id, NamedIdentity));
			/** @type {any} */ const door = /** @type any */ (world.get(id, DoorState));
			/** @type {any} */ const objState = /** @type any */ (world.get(id, ObjectState));
			/** @type {any} */ const col = /** @type any */ (world.get(id, Collider));
			/** @type {any} */ const itemInfo = /** @type any */ (world.get(id, ItemInfo));

			let kind = "default";
			if (door) {
				kind = door.open ? "door_open" : "door_closed";
			} else if (objState && ident?.identity === "furnace") {
				kind = objState.state === "lit" ? "furnace" : "furnace_unlit";
			} else if (objState && ident?.identity === "millstone") {
				kind = objState.state === "working" ? "millstone_active" : "millstone";
			} else if (objState && ident?.identity === "anvil") {
				kind = objState.state === "working" ? "anvil_active" : "anvil";
			} else if (objState && ident?.identity === "lantern_post") {
				kind = objState.state === "lit" ? "lantern_post" : "lantern_post_unlit";
			} else if (isPlayer) {
				kind = ident?.identity || "player";
			} else {
				kind = ident?.identity || ident?.name || "default";
			}

			let layer = 300; // actors
			if (itemInfo) layer = 250; // items/ground (above doors/stairs, below actors)
			else if (door) layer = 200; // doors/walls-like entities
			else if (isPlayer) layer = 400; // player on top

			/** @type {EntityView|null} */
			const stackSeq = Number(world.get(id, GroundStackOrder)?.seq || 0) | 0;
			let rec = /** @type any */ (_entityRecs.get(id) || null);
			if (!rec) {
				rec = { id, kind, pos: { x: pos.x, y: pos.y }, tags: [], layer, hp: 0, maxHp: 0, isPet: false, showHealthBar: false, procStates: null, stackSeq, facing: null };
				_entityRecs.set(id, rec);
			} else {
				rec.kind = kind;
				rec.layer = layer;
				rec.pos.x = pos.x; rec.pos.y = pos.y;
				rec.tags.length = 0;
				rec.procStates = null;
				rec.stackSeq = stackSeq;
				rec.facing = null;
			}

			// Project select status types into tags for display-only logic.
			projectDisplayTags(world, id, rec);
			projectEquipmentDisplayTags(world, id, rec);
			projectMonsterDefTags(kind, rec);
			projectItemAffixDisplayTags(kind, itemInfo, rec);
			projectCombatUi(world, id, rec, playerFactionKey);
			projectProcStateTags(world, id, rec);
			projectFacing(world, id, rec);
			if (world.has(id, Flying) && !rec.tags.includes('flying')) rec.tags.push('flying');
			if ((kind === "bell" || kind === "tavern_sign") && !rec.tags.includes('above_roof')) rec.tags.push('above_roof');
			if (_questGiverIds.has(id) && !rec.tags.includes('quest_giver')) rec.tags.push('quest_giver');
			if (kind === 'legendary_chest') rec.tags.push('legendary_glowing');
			if (kind === 'epic_chest') rec.tags.push('epic_glowing');

			_allEntities.push(rec);
			collectedIds.add(id);

			// solids list for display/collision readers (entity-based only: doors)
			if (col && col.solid) {
				let srec = _solidRecs.get(id);
				if (!srec) { srec = { id, x: pos.x, y: pos.y }; _solidRecs.set(id, srec); }
				else { srec.x = pos.x; srec.y = pos.y; }
				_view.solids.push(srec);
			}
		});
	} else {
		for (const [id, pos] of world.query(Position)) {
			if (world.has(id, PlasmaCloud) || world.has(id, HazardArea)) continue;
			if (world.has(id, Burned)) continue;
			if (world.has(id, DistrictProfile) || world.has(id, EntranceProfile)) continue;
			// Hide unrevealed traps — completely invisible until triggered
			/** @type {any} */ const trap2 = /** @type any */ (world.get(id, Trap));
			if (trap2 && !trap2.revealed) continue;
			const isPlayer = world.has(id, Player);
			/** @type {any} */ const ident = /** @type any */ (world.get(id, NamedIdentity));
			/** @type {any} */ const door = /** @type any */ (world.get(id, DoorState));
			/** @type {any} */ const objState = /** @type any */ (world.get(id, ObjectState));
			/** @type {any} */ const col = /** @type any */ (world.get(id, Collider));
			/** @type {any} */ const itemInfo = /** @type any */ (world.get(id, ItemInfo));

			let kind = "default";
			if (door) {
				kind = door.open ? "door_open" : "door_closed";
			} else if (objState && ident?.identity === "furnace") {
				kind = objState.state === "lit" ? "furnace" : "furnace_unlit";
			} else if (objState && ident?.identity === "millstone") {
				kind = objState.state === "working" ? "millstone_active" : "millstone";
			} else if (objState && ident?.identity === "anvil") {
				kind = objState.state === "working" ? "anvil_active" : "anvil";
			} else if (objState && ident?.identity === "lantern_post") {
				kind = objState.state === "lit" ? "lantern_post" : "lantern_post_unlit";
			} else if (isPlayer) {
				kind = ident?.identity || "player";
			} else {
				kind = ident?.identity || ident?.name || "default";
			}

			let layer = 300; // actors
			if (itemInfo) layer = 250; // items/ground (above doors/stairs, below actors)
			else if (door) layer = 200; // doors/walls-like entities
			else if (isPlayer) layer = 400; // player on top

			const stackSeq2 = Number(world.get(id, GroundStackOrder)?.seq || 0) | 0;
			/** @type {EntityView|null} */
			let rec = /** @type any */ (_entityRecs.get(id) || null);
			if (!rec) {
				rec = { id, kind, pos: { x: pos.x, y: pos.y }, tags: [], layer, hp: 0, maxHp: 0, isPet: false, showHealthBar: false, procStates: null, stackSeq: stackSeq2, facing: null };
				_entityRecs.set(id, rec);
			} else {
				rec.kind = kind;
				rec.layer = layer;
				rec.pos.x = pos.x; rec.pos.y = pos.y;
				rec.tags.length = 0;
				rec.procStates = null;
				rec.stackSeq = stackSeq2;
				rec.facing = null;
			}

			// Project select status types into tags for display-only logic.
			projectDisplayTags(world, id, rec);
			projectEquipmentDisplayTags(world, id, rec);
			projectMonsterDefTags(kind, rec);
			projectItemAffixDisplayTags(kind, itemInfo, rec);
			projectCombatUi(world, id, rec, '');
			projectProcStateTags(world, id, rec);
			projectFacing(world, id, rec);
			if (world.has(id, Flying) && !rec.tags.includes('flying')) rec.tags.push('flying');
			if ((kind === "bell" || kind === "tavern_sign") && !rec.tags.includes('above_roof')) rec.tags.push('above_roof');
			if (_questGiverIds.has(id) && !rec.tags.includes('quest_giver')) rec.tags.push('quest_giver');
			if (kind === 'legendary_chest') rec.tags.push('legendary_glowing');
			if (kind === 'epic_chest') rec.tags.push('epic_glowing');

			_allEntities.push(rec);
			collectedIds.add(id);
			if (isPlayer) {
				if (!_view.player) _view.player = { id, pos: { x: pos.x, y: pos.y } };
				else { _view.player.id = id; _view.player.pos.x = pos.x; _view.player.pos.y = pos.y; }
			}

			// solids list for display/collision readers (entity-based only: doors)
			if (col && col.solid) {
				let srec = _solidRecs.get(id);
				if (!srec) { srec = { id, x: pos.x, y: pos.y }; _solidRecs.set(id, srec); }
				else { srec.x = pos.x; srec.y = pos.y; }
				_view.solids.push(srec);
			}
		}

		}

		// Pets are always tracked even outside the player-centric view query.
		for (const [id, _pet, pos] of world.query(Pet, Position)) {
			if (collectedIds.has(id)) continue;
			if (!world.isAlive(id)) continue;
			/** @type {any} */ const ident = /** @type any */ (world.get(id, NamedIdentity));
			/** @type {any} */ const col = /** @type any */ (world.get(id, Collider));
			const kind = ident?.identity || ident?.name || "default";
			const stackSeq = Number(world.get(id, GroundStackOrder)?.seq || 0) | 0;
			let rec = /** @type any */ (_entityRecs.get(id) || null);
			if (!rec) {
				rec = { id, kind, pos: { x: pos.x, y: pos.y }, tags: [], layer: 300, hp: 0, maxHp: 0, isPet: false, showHealthBar: false, procStates: null, stackSeq, facing: null };
				_entityRecs.set(id, rec);
			} else {
				rec.kind = kind;
				rec.layer = 300;
				rec.pos.x = pos.x; rec.pos.y = pos.y;
				rec.tags.length = 0;
				rec.procStates = null;
				rec.stackSeq = stackSeq;
				rec.facing = null;
			}

			projectDisplayTags(world, id, rec);
			projectEquipmentDisplayTags(world, id, rec);
			projectMonsterDefTags(kind, rec);
			projectCombatUi(world, id, rec, playerFactionKey);
			projectProcStateTags(world, id, rec);
			projectFacing(world, id, rec);
			if (world.has(id, Flying) && !rec.tags.includes("flying")) rec.tags.push("flying");
			if (_questGiverIds.has(id) && !rec.tags.includes("quest_giver")) rec.tags.push("quest_giver");

			_allEntities.push(rec);
			collectedIds.add(id);

			if (col && col.solid) {
				let srec = _solidRecs.get(id);
				if (!srec) { srec = { id, x: pos.x, y: pos.y }; _solidRecs.set(id, srec); }
				else { srec.x = pos.x; srec.y = pos.y; }
				_view.solids.push(srec);
			}
		}

		const thermalSenseRange = thermalSenseStrength > 0
			? (Math.max(playerVisionRadius, THERMAL_BASE_RANGE) + Math.min(6, (thermalSenseStrength | 0) * 2))
		: 0;
	const espSenseRange = espSenseStrength > 0
		? (Math.max(playerVisionRadius, ESP_BASE_RANGE) + 6)
		: 0;

	/** @type {Map<number, boolean>} */
	const visibleById = new Map();
	for (let i = 0; i < _allEntities.length; i++) {
		const rec = _allEntities[i];
		let directVisible = false;
		if (_view.player && rec.id === _view.player.id) {
			directVisible = true;
		} else if (_view.player) {
			directVisible = !!isVisible(rec.pos.x, rec.pos.y);
			if (!directVisible) {
				directVisible = !!hasOverworldAerialLOS(world, {
					sourceId: _view.player.id,
					targetId: rec.id,
					sourcePos: _view.player.pos,
					targetPos: rec.pos,
					range: playerVisionRadius,
				});
			}
			if (
				directVisible
				&& playerFacingForAwareness
				&& awarenessConeDegrees < 360
				&& isPerceptionMonster(world, rec.id, playerFactionKey)
				&& !isPointInFacingCone(
					_view.player.pos.x,
					_view.player.pos.y,
					rec.pos.x,
					rec.pos.y,
					playerFacingForAwareness.dx,
					playerFacingForAwareness.dy,
					awarenessConeDegrees,
				)
			) {
				directVisible = false;
			}
		}
		visibleById.set(rec.id, directVisible);
		if (!directVisible || !_view.player) continue;
		if (!isPerceptionMonster(world, rec.id, playerFactionKey)) continue;
		rememberPerceptionContact(currentDepth, rec.id, {
			x: rec.pos.x,
			y: rec.pos.y,
			kind: rec.kind,
			layer: rec.layer,
			lastSeenTurn: _view.turn,
		});
	}

	const memoryKindPool = memoryTamperStrength > 0
		? listPerceptionKinds(currentDepth, _view.turn, { ttl: MEMORY_TTL_TURNS })
		: [];

	// Filter entities by direct vision and fall back to memory/sense channels.
	for (let i = 0; i < _allEntities.length; i++) {
		const rec = _allEntities[i];
		if (_view.player && rec.id === _view.player.id) {
			_view.entities.push(rec);
			continue;
		}
		if (rec.isPet) {
			_view.entities.push(rec);
			continue;
		}

		if (visibleById.get(rec.id) === true) {
			_view.entities.push(rec);
			continue;
		}
		if (!_view.player) continue;
		if (isFixedDecorationEntity(world, rec.id) && isExplored(rec.pos.x, rec.pos.y)) {
			_view.entities.push(makePerceptionEcho(rec, ["memory_recent", "memory_fixed"], rec.pos));
			continue;
		}
		if (!isPerceptionMonster(world, rec.id, playerFactionKey)) continue;

		const dist = chebyshevDistance(_view.player.pos, rec.pos);
		if (dist <= TOUCH_RESOLVE_RANGE) {
			rememberPerceptionContact(currentDepth, rec.id, {
				x: rec.pos.x,
				y: rec.pos.y,
				kind: rec.kind,
				layer: rec.layer,
				lastSeenTurn: _view.turn,
			});
			_view.entities.push(rec);
			continue;
		}
		const memory = projectPerceptionContact(currentDepth, rec.id, _view.turn, {
			ttl: MEMORY_TTL_TURNS,
			seed: _view.seed,
			tamperStrength: memoryTamperStrength,
			kindPool: memoryKindPool,
		});
		if (memory) {
			const tags = memory.tampered
				? ["memory_recent", "memory_tampered"]
				: ["memory_recent"];
			_view.entities.push(makePerceptionEcho(rec, tags, { x: memory.x, y: memory.y }, memory.kind));
			continue;
		}

		if (espSenseStrength > 0 && dist <= espSenseRange && hasMindForEsp(world, rec.id)) {
			_view.entities.push(makePerceptionEcho(rec, ["esp_sensed"], rec.pos));
			continue;
		}

		if (thermalSenseStrength > 0 && dist <= thermalSenseRange) {
			_view.entities.push(makePerceptionEcho(rec, ["thermal_sensed"], rec.pos));
		}
	}
	_view.entities.sort((a, b) => (
		(a.layer - b.layer) ||
		(a.pos.y - b.pos.y) ||
		(a.pos.x - b.pos.x) ||
		(a.id - b.id)
	));

	// Collect engravings (visible or explored tiles)
	for (const [id, eng, pos] of world.query(Engraving, Position)) {
		if (isVisible(pos.x, pos.y) || isExplored(pos.x, pos.y)) {
			_view.engravings.push({ id, text: eng.text, profane: !!eng.profane, pos: { x: pos.x, y: pos.y } });
		}
	}

	const roofTiles = collectOverworldRoofs(world, _view.player?.pos || null);
	for (let i = 0; i < roofTiles.length; i++) {
		_view.roofs.push(roofTiles[i]);
	}

	return _view;
}
