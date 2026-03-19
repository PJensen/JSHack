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
import { getMonsterTags } from '../../rules/data/monsters.js';
import { Flying } from '../../rules/components/Flying.js';
import { hasOverworldAerialLOS } from '../../rules/utils/flyingEligibility.js';
import { DungeonState } from "../../rules/components/DungeonState.js";
import { TURNS_PER_DAY } from "../../rules/data/calendar.js";
import { QuestBindings } from "../../rules/components/QuestBindings.js";
import { QuestState } from "../../rules/components/QuestState.js";
import { WeatherState } from "../../rules/components/WeatherState.js";
import { Burned } from "../../rules/components/Burned.js";
import { getDestroyedTileLedger } from "../../rules/utils/destroyedTiles.js";
import { getEffectiveVisionRange } from "../../rules/utils/blind.js";
import { ActiveEffects } from "../../rules/components/ActiveEffects.js";
import { DistrictProfile } from "../../rules/components/DistrictProfile.js";
import { EntranceProfile } from "../../rules/components/EntranceProfile.js";

// Reuse view/record objects across frames to reduce allocations/GC churn.
/** @typedef {{ id:number, kind:string, pos:{x:number,y:number}, tags:string[], layer:number, hp:number, maxHp:number, isPet:boolean, showHealthBar:boolean }} EntityView */
/** @typedef {{ id:number, x:number, y:number }} SolidView */
/** @typedef {{ x:number, y:number, kind:string, alpha:number, burning?:boolean, smoking?:boolean }} RoofTileView */
/** @typedef {{ turn:number, seed:number, player: { id:number, pos:{x:number,y:number} } | null, entities: EntityView[], solids: SolidView[], emissives: any[], roofs: RoofTileView[], tileGrid: any, isVisible: ((x:number,y:number)=>boolean)|null, isExplored: ((x:number,y:number)=>boolean)|null }} WorldView */

/** @typedef {{ id:number, text:string, profane:boolean, pos:{x:number,y:number} }} EngravingView */

/** @type {WorldView} */
const _view = { turn: 0, seed: 0, player: null, entities: [], solids: [], emissives: [], roofs: [], engravings: [], tileGrid: null, isVisible: null, isExplored: null, weather: "clear", playerSheltered: false, nightAlpha: 0 };
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
]);
// Proc state effect keys that should be projected onto enemy entity views for glyph fx.
const ENTITY_PROC_STATE_KEYS = new Set(['doom_clock', 'cataclysm_mark']);

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
	if (!stat || !Array.isArray(stat.statuses)) return;
	for (let i = 0; i < stat.statuses.length; i++) {
		const s = stat.statuses[i];
		const t = normalizeDisplayStatusType(s?.type);
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

	if (hasAffix('flaming') && !rec.tags.includes('glowing')) {
		rec.tags.push('glowing');
	}
	if (hasAffix('venomous1') || VENOM_GLOW_ITEM_KINDS.has(String(kind || ''))) {
		if (!rec.tags.includes('venom_glowing')) rec.tags.push('venom_glowing');
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

	const maxHp = Math.max(1, vit.maxHp | 0);
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
		if (!rec.procStates) rec.procStates = [];
		rec.procStates.push({ key, stacks });
	}
}

/**
 * @param {import('../../lib/ecs-js/index.js').World} world
 * @returns {WorldView}
 */
export function buildWorldView(world) {
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

	// Read weather state (singleton on overworld)
	let _isOverworld = false;
	for (const [, ds] of world.query(DungeonState)) {
		_isOverworld = (ds.currentDepth === 0 || ds.profileType === "overworld");
		break;
	}
	for (const [, ws] of world.query(WeatherState)) {
		_view.weather = ws.current || "clear";
		break;
	}

	// Compute night darkness (overworld only, smooth day-night cycle)
	_view.nightAlpha = 0;
	if (_isOverworld) {
		const t = (world.step % TURNS_PER_DAY) / TURNS_PER_DAY; // 0→1 within day
		// Dawn/dusk fractions (auto-scale with TURNS_PER_DAY)
		const DAWN_START = 0.208; // ~150/720  (5:00 AM)
		const DAWN_END   = 0.292; // ~210/720  (7:00 AM)
		const DUSK_START = 0.708; // ~510/720  (5:00 PM)
		const DUSK_END   = 0.806; // ~580/720  (7:20 PM)
		if (t < DAWN_START || t >= DUSK_END) {
			_view.nightAlpha = 1;
		} else if (t < DAWN_END) {
			_view.nightAlpha = 1 - (t - DAWN_START) / (DAWN_END - DAWN_START);
		} else if (t < DUSK_START) {
			_view.nightAlpha = 0;
		} else {
			_view.nightAlpha = (t - DUSK_START) / (DUSK_END - DUSK_START);
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
		const pad = 2;
		const bounds = {
			x0: _view.player.pos.x - radius - pad,
			y0: _view.player.pos.y - radius - pad,
			x1: _view.player.pos.x + radius + pad,
			y1: _view.player.pos.y + radius + pad,
		};
		const blockedMap = buildBlocksVisionMap(world, bounds);
		const isBlocked = blockedCallback(blockedMap);
		updateFOV(_view.turn, _view.player.pos.x, _view.player.pos.y, radius, isBlocked);
	}

	_view.isVisible = isVisible;
	_view.isExplored = isExplored;
	const playerFactionKey = _view.player ? String(world.get(_view.player.id, Faction)?.key || 'player').trim().toLowerCase() : '';

	// Collect entity records near the player (or all if no player).
	if (_view.player) {
		ensureSpatialIndex(world);
		const radius = getEffectiveVisionRange(world, _view.player.id);
		playerVisionRadius = radius;
		const viewR = (radius | 0) + 4;
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
			if (itemInfo) layer = 100; // items/ground
			else if (door) layer = 200; // doors/walls-like entities
			else if (isPlayer) layer = 400; // player on top

			/** @type {EntityView|null} */
			let rec = /** @type any */ (_entityRecs.get(id) || null);
			if (!rec) {
				rec = { id, kind, pos: { x: pos.x, y: pos.y }, tags: [], layer, hp: 0, maxHp: 0, isPet: false, showHealthBar: false, procStates: null };
				_entityRecs.set(id, rec);
			} else {
				rec.kind = kind;
				rec.layer = layer;
				rec.pos.x = pos.x; rec.pos.y = pos.y;
				rec.tags.length = 0;
				rec.procStates = null;
			}

			// Project select status types into tags for display-only logic.
			projectDisplayTags(world, id, rec);
			projectEquipmentDisplayTags(world, id, rec);
			projectMonsterDefTags(kind, rec);
			projectItemAffixDisplayTags(kind, itemInfo, rec);
			projectCombatUi(world, id, rec, playerFactionKey);
			projectProcStateTags(world, id, rec);
			if (world.has(id, Flying) && !rec.tags.includes('flying')) rec.tags.push('flying');
			if ((kind === "bell" || kind === "tavern_sign") && !rec.tags.includes('above_roof')) rec.tags.push('above_roof');
			if (_questGiverIds.has(id) && !rec.tags.includes('quest_giver')) rec.tags.push('quest_giver');

			_allEntities.push(rec);

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
			if (itemInfo) layer = 100; // items/ground
			else if (door) layer = 200; // doors/walls-like entities
			else if (isPlayer) layer = 400; // player on top

			/** @type {EntityView|null} */
			let rec = /** @type any */ (_entityRecs.get(id) || null);
			if (!rec) {
				rec = { id, kind, pos: { x: pos.x, y: pos.y }, tags: [], layer, hp: 0, maxHp: 0, isPet: false, showHealthBar: false, procStates: null };
				_entityRecs.set(id, rec);
			} else {
				rec.kind = kind;
				rec.layer = layer;
				rec.pos.x = pos.x; rec.pos.y = pos.y;
				rec.tags.length = 0;
				rec.procStates = null;
			}

			// Project select status types into tags for display-only logic.
			projectDisplayTags(world, id, rec);
			projectEquipmentDisplayTags(world, id, rec);
			projectMonsterDefTags(kind, rec);
			projectItemAffixDisplayTags(kind, itemInfo, rec);
			projectCombatUi(world, id, rec, '');
			projectProcStateTags(world, id, rec);
			if (world.has(id, Flying) && !rec.tags.includes('flying')) rec.tags.push('flying');
			if ((kind === "bell" || kind === "tavern_sign") && !rec.tags.includes('above_roof')) rec.tags.push('above_roof');
			if (_questGiverIds.has(id) && !rec.tags.includes('quest_giver')) rec.tags.push('quest_giver');

			_allEntities.push(rec);
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

	// Filter entities by FOV: only include visible entities + always include player
	for (let i = 0; i < _allEntities.length; i++) {
		const rec = _allEntities[i];
		if (_view.player && rec.id === _view.player.id) {
			_view.entities.push(rec);
			continue;
		}
		const aerialVisible = !!(_view.player && hasOverworldAerialLOS(world, {
			sourceId: _view.player.id,
			targetId: rec.id,
			sourcePos: _view.player.pos,
			targetPos: rec.pos,
			range: playerVisionRadius,
		}));
		if (isVisible(rec.pos.x, rec.pos.y) || aerialVisible) {
			_view.entities.push(rec);
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
