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
import { getTile, forEachTileInRect } from '../../rules/environment/dungeon/tileMap.js';
import { TILE_DOOR, TILE_FLOOR, TILE_WALL } from "../../rules/environment/dungeon/constants.js";
import { Brain } from '../../rules/components/Brain.js';
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
import { WeatherState } from "../../rules/components/WeatherState.js";
import { Burned } from "../../rules/components/Burned.js";
import { getDestroyedTileLedger } from "../../rules/utils/destroyedTiles.js";

// Reuse view/record objects across frames to reduce allocations/GC churn.
/** @typedef {{ id:number, kind:string, pos:{x:number,y:number}, tags:string[], layer:number, hp:number, maxHp:number, isPet:boolean, showHealthBar:boolean }} EntityView */
/** @typedef {{ id:number, x:number, y:number }} SolidView */
/** @typedef {{ x:number, y:number, kind:string, alpha:number, burning?:boolean, smoking?:boolean }} RoofTileView */
/** @typedef {{ turn:number, seed:number, player: { id:number, pos:{x:number,y:number} } | null, entities: EntityView[], solids: SolidView[], emissives: any[], roofs: RoofTileView[], tileGrid: any, isVisible: ((x:number,y:number)=>boolean)|null, isExplored: ((x:number,y:number)=>boolean)|null }} WorldView */

/** @typedef {{ id:number, text:string, profane:boolean, pos:{x:number,y:number} }} EngravingView */

/** @type {WorldView} */
const _view = { turn: 0, seed: 0, player: null, entities: [], solids: [], emissives: [], roofs: [], engravings: [], tileGrid: null, isVisible: null, isExplored: null, weather: "clear", playerSheltered: false };
/** @type {Map<number, EntityView>} */
const _entityRecs = new Map();   // id -> { id, kind, pos:{x,y}, tags:[] }
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
]);
const VENOM_GLOW_ITEM_KINDS = new Set(['nightfang_dagger', 'venomfang_dagger', 'nightfang', 'venomfang']);
const POTION_GLOW_DISABLED_KINDS = new Set();

/** @type {EntityView[]} reusable temp buffer for entity collection before FOV filter */
const _allEntities = [];
const OVERWORLD_ROOF_SEED_IDENTITIES = new Set(["alchemy_bench", "bed_home", "tavern_keg", "millstone", "church_altar", "cooking_fire", "furnace"]);

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
const ROOF_BURN_PROPAGATION_LIMIT = 2;
/** How many turns after burning a tile still smolders (emits smoke). */
const SMOLDER_TURNS = 30;

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
 * Flood-fill one indoor floor region, then wrap it with any touching doors/walls for roof rendering.
 * @param {number} seedX
 * @param {number} seedY
 */
function collectRoofedBuilding(seedX, seedY) {
	if (getTile(seedX, seedY) !== TILE_FLOOR) return null;
	const floorKeys = new Set();
	const doorKeys = new Set();
	const wallKeys = new Set();
	const exposedFloorKeys = new Set();
	const queue = [[seedX, seedY]];
	const seen = new Set([xyKey(seedX, seedY)]);
	const cardinal = [
		[1, 0],
		[-1, 0],
		[0, 1],
		[0, -1],
	];

	for (let i = 0; i < queue.length; i++) {
		const [x, y] = queue[i];
		if (getTile(x, y) !== TILE_FLOOR) continue;
		const key = xyKey(x, y);
		floorKeys.add(key);
		for (let j = 0; j < cardinal.length; j++) {
			const nx = x + cardinal[j][0];
			const ny = y + cardinal[j][1];
			const nextKey = xyKey(nx, ny);
			const tile = getTile(nx, ny);
			if (tile === TILE_FLOOR && !seen.has(nextKey)) {
				seen.add(nextKey);
				queue.push([nx, ny]);
			} else if (tile === TILE_DOOR) {
				doorKeys.add(nextKey);
			} else if (tile !== TILE_FLOOR && tile !== TILE_WALL) {
				exposedFloorKeys.add(key);
			}
		}
	}

	const shellKeys = [...floorKeys, ...doorKeys];
	for (let i = 0; i < shellKeys.length; i++) {
		const { x, y } = keyToXY(shellKeys[i]);
		for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				if (dx === 0 && dy === 0) continue;
				const nx = x + dx;
				const ny = y + dy;
				if (getTile(nx, ny) === TILE_WALL) {
					wallKeys.add(xyKey(nx, ny));
				}
			}
		}
	}

	if (!floorKeys.size) return null;
	return { floorKeys, doorKeys, wallKeys, exposedFloorKeys };
}

function collectCottageBuildingFromBed(seedX, seedY) {
	const floorXs = [seedX, seedX + 1, seedX + 2];
	const floorYs = [seedY - 1, seedY, seedY + 1];
	for (let iy = 0; iy < floorYs.length; iy++) {
		for (let ix = 0; ix < floorXs.length; ix++) {
			if (getTile(floorXs[ix], floorYs[iy]) !== TILE_FLOOR) return null;
		}
	}

	const northDoor = { x: seedX + 1, y: seedY - 2 };
	const southDoor = { x: seedX + 1, y: seedY + 2 };
	let door = null;
	if (getTile(northDoor.x, northDoor.y) === TILE_DOOR) door = northDoor;
	else if (getTile(southDoor.x, southDoor.y) === TILE_DOOR) door = southDoor;
	else return null;

	const floorKeys = new Set();
	for (let iy = 0; iy < floorYs.length; iy++) {
		for (let ix = 0; ix < floorXs.length; ix++) {
			floorKeys.add(xyKey(floorXs[ix], floorYs[iy]));
		}
	}

	const doorKeys = new Set([xyKey(door.x, door.y)]);
	const wallKeys = new Set();
	for (let y = seedY - 2; y <= seedY + 2; y++) {
		for (let x = seedX - 1; x <= seedX + 3; x++) {
			const key = xyKey(x, y);
			if (floorKeys.has(key) || doorKeys.has(key)) continue;
			wallKeys.add(key);
		}
	}

	const exposedFloorKeys = new Set();
	for (const key of floorKeys) {
		const { x, y } = keyToXY(key);
		for (let i = 0; i < CARDINAL_STEPS.length; i++) {
			const nx = x + CARDINAL_STEPS[i][0];
			const ny = y + CARDINAL_STEPS[i][1];
			const tile = getTile(nx, ny);
			if (tile === TILE_FLOOR || tile === TILE_WALL || tile === TILE_DOOR) continue;
			exposedFloorKeys.add(key);
			break;
		}
	}

	return { floorKeys, doorKeys, wallKeys, exposedFloorKeys };
}

function collectRectRoofedBuilding(floorX0, floorY0, floorX1, floorY1, doorX, doorY) {
	const floorKeys = new Set();
	for (let y = floorY0; y <= floorY1; y++) {
		for (let x = floorX0; x <= floorX1; x++) {
			if (getTile(x, y) !== TILE_FLOOR) return null;
			floorKeys.add(xyKey(x, y));
		}
	}
	if (getTile(doorX, doorY) !== TILE_DOOR) return null;

	const doorKeys = new Set([xyKey(doorX, doorY)]);
	const wallKeys = new Set();
	for (let y = floorY0 - 1; y <= floorY1 + 1; y++) {
		for (let x = floorX0 - 1; x <= floorX1 + 1; x++) {
			const key = xyKey(x, y);
			if (floorKeys.has(key) || doorKeys.has(key)) continue;
			wallKeys.add(key);
		}
	}

	const exposedFloorKeys = new Set();
	for (const key of floorKeys) {
		const { x, y } = keyToXY(key);
		for (let i = 0; i < CARDINAL_STEPS.length; i++) {
			const nx = x + CARDINAL_STEPS[i][0];
			const ny = y + CARDINAL_STEPS[i][1];
			const tile = getTile(nx, ny);
			if (tile === TILE_FLOOR || tile === TILE_WALL || tile === TILE_DOOR) continue;
			exposedFloorKeys.add(key);
			break;
		}
	}

	return { floorKeys, doorKeys, wallKeys, exposedFloorKeys };
}

function collectFixedRoofedBuilding(identity, seedX, seedY) {
	switch (identity) {
		case "alchemy_bench":
			return collectRectRoofedBuilding(seedX - 3, seedY, seedX + 3, seedY + 2, seedX, seedY + 3);
		case "church_altar":
			return collectRoofedBuilding(seedX, seedY);
		case "cooking_fire":
			return collectRectRoofedBuilding(seedX - 6, seedY - 2, seedX, seedY, seedX - 3, seedY + 1);
		case "millstone":
			return collectRectRoofedBuilding(seedX - 1, seedY - 1, seedX + 1, seedY + 1, seedX, seedY + 2);
		case "tavern_keg":
			return collectRectRoofedBuilding(seedX, seedY, seedX + 6, seedY + 4, seedX + 3, seedY + 5);
		case "furnace":
			return collectRectRoofedBuilding(seedX, seedY, seedX + 2, seedY + 2, seedX + 3, seedY + 1);
		case "bed_home":
			return collectCottageBuildingFromBed(seedX, seedY);
		default:
			return collectRoofedBuilding(seedX, seedY);
	}
}

/**
 * @param {Set<string>} floorKeys
 * @param {Set<string>} doorKeys
 * @param {Set<string>} wallKeys
 * @param {number} alpha
 */
function roofTilesFromBuilding(floorKeys, doorKeys, wallKeys, exposedFloorKeys, alpha) {
	const coveredFloorKeys = [...floorKeys].filter((key) => !exposedFloorKeys.has(key));
	if (!coveredFloorKeys.length) return [];
	const coveredShellKeys = new Set();
	const shellCandidates = [...wallKeys, ...doorKeys];
	for (let i = 0; i < shellCandidates.length; i++) {
		const shellKey = shellCandidates[i];
		const { x, y } = keyToXY(shellKey);
		for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				if (dx === 0 && dy === 0) continue;
				if (floorKeys.has(xyKey(x + dx, y + dy)) && !exposedFloorKeys.has(xyKey(x + dx, y + dy))) {
					coveredShellKeys.add(shellKey);
				}
			}
		}
	}
	const allKeys = [...coveredShellKeys, ...coveredFloorKeys];
	const doorKeySet = new Set(doorKeys);
	let minY = Infinity;
	let maxY = -Infinity;
	for (let i = 0; i < allKeys.length; i++) {
		const { y } = keyToXY(allKeys[i]);
		if (y < minY) minY = y;
		if (y > maxY) maxY = y;
	}
	const shadowCutoff = minY + Math.floor((maxY - minY) * 0.5);
	return allKeys.map((key) => {
		const { x, y } = keyToXY(key);
		const singed = keyWithinRadius(key, exposedFloorKeys, 1);
		const tileAlpha = (doorKeySet.has(key) ? alpha * 0.4 : alpha) * (singed ? 0.92 : 1.0);
		let kind = y <= shadowCutoff ? "roof_thatch_shadow" : "roof_thatch_lit";
		if (singed) kind += "_charred";
		return { x, y, kind, alpha: tileAlpha, burning: false };
	});
}

/**
 * @param {Set<string>} floorKeys
 * @param {Set<string>} sourceKeys
 * @param {Map<string, number>} seedStrengths
 * @returns {Map<string, number>}
 */
function propagateBurnScores(floorKeys, sourceKeys, seedStrengths) {
	const scores = new Map();
	const queue = [];
	for (const key of sourceKeys) {
		if (!floorKeys.has(key)) continue;
		const strength = Math.max(0, Number(seedStrengths.get(key) || 0));
		if (!(strength > 0)) continue;
		const prev = Number(scores.get(key) || -Infinity);
		if (strength <= prev) continue;
		scores.set(key, strength);
		queue.push(key);
	}
	for (let i = 0; i < queue.length; i++) {
		const key = queue[i];
		const score = Number(scores.get(key) || 0);
		if (!(score > 1)) continue;
		const { x, y } = keyToXY(key);
		for (let j = 0; j < CARDINAL_STEPS.length; j++) {
			const nx = x + CARDINAL_STEPS[j][0];
			const ny = y + CARDINAL_STEPS[j][1];
			const nextKey = xyKey(nx, ny);
			if (!floorKeys.has(nextKey)) continue;
			const nextScore = score - 1;
			const prev = Number(scores.get(nextKey) || -Infinity);
			if (nextScore <= prev) continue;
			scores.set(nextKey, nextScore);
			queue.push(nextKey);
		}
	}
	return scores;
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
	const visited = new Set();

	for (const [, ident, pos] of world.query(NamedIdentity, Position)) {
		const identity = String(ident?.identity || "");
		if (!OVERWORLD_ROOF_SEED_IDENTITIES.has(identity)) continue;
		const building = collectFixedRoofedBuilding(identity, pos.x, pos.y);
		if (!building) continue;
		const floorKeys = [...building.floorKeys];
		if (floorKeys.some((key) => visited.has(key))) continue;
		for (let i = 0; i < floorKeys.length; i++) visited.add(floorKeys[i]);
		// Compute burn propagation (needed for both shelter check and roof rendering)
		const burnedSeedStrengths = new Map();
		const burnedSeedKeys = new Set();
		const activeSeedStrengths = new Map();
		const activeSeedKeys = new Set();
		/** Floor keys adjacent to tiles destroyed within SMOLDER_TURNS (for post-fire smoke). */
		const smolderingSeedKeys = new Set();
		for (const [key] of Object.entries(destroyedTiles || {})) {
			const rec = destroyedTiles[key];
			if (
				!building.floorKeys.has(key)
				&& !building.doorKeys.has(key)
				&& !building.wallKeys.has(key)
				&& !keyWithinRadius(key, building.floorKeys, 1)
			) continue;
			const age = Math.max(1, (_view.turn | 0) - (Number(rec?.destroyedAtTurn || 0) | 0) + 1);
			const strength = Math.min(ROOF_BURN_PROPAGATION_LIMIT, age);
			const { x, y } = keyToXY(key);
			for (let j = 0; j < CARDINAL_STEPS.length; j++) {
				const floorKey = xyKey(x + CARDINAL_STEPS[j][0], y + CARDINAL_STEPS[j][1]);
				if (!building.floorKeys.has(floorKey)) continue;
				burnedSeedKeys.add(floorKey);
				const prev = Number(burnedSeedStrengths.get(floorKey) || 0);
				if (strength > prev) burnedSeedStrengths.set(floorKey, strength);
				if (age <= SMOLDER_TURNS) smolderingSeedKeys.add(floorKey);
			}
		}
		for (const key of activeFireKeys) {
			if (
				!building.floorKeys.has(key)
				&& !building.doorKeys.has(key)
				&& !building.wallKeys.has(key)
				&& !keyWithinRadius(key, building.floorKeys, 1)
			) continue;
			const { x, y } = keyToXY(key);
			for (let j = 0; j < CARDINAL_STEPS.length; j++) {
				const floorKey = xyKey(x + CARDINAL_STEPS[j][0], y + CARDINAL_STEPS[j][1]);
				if (!building.floorKeys.has(floorKey)) continue;
				activeSeedKeys.add(floorKey);
				activeSeedStrengths.set(floorKey, ROOF_BURN_PROPAGATION_LIMIT);
			}
		}
		const burnedScores = propagateBurnScores(building.floorKeys, burnedSeedKeys, burnedSeedStrengths);
		const activeScores = propagateBurnScores(building.floorKeys, activeSeedKeys, activeSeedStrengths);
		const burnedScoreKeys = new Set(burnedScores.keys());
		const activeScoreKeys = new Set(activeScores.keys());
		const exposedFloorKeys = new Set(building.exposedFloorKeys);
		for (const floorKey of building.floorKeys) {
			if (Number(burnedScores.get(floorKey) || 0) > 0 && Number(activeScores.get(floorKey) || 0) <= 0) {
				exposedFloorKeys.add(floorKey);
			}
		}

		// Player inside this building — determine shelter from weather, skip roof rendering
		if (playerKey && (building.floorKeys.has(playerKey) || building.doorKeys.has(playerKey))) {
			const nearBurned = keyWithinRadius(playerKey, burnedScoreKeys, 1);
			const nearActiveFire = keyWithinRadius(playerKey, activeScoreKeys, 1);
			const roofGone = nearBurned && !nearActiveFire;
			if (building.floorKeys.has(playerKey)) {
				_view.playerSheltered = !exposedFloorKeys.has(playerKey) && !roofGone;
			} else {
				// Door position — sheltered if adjacent to any covered floor
				const { x, y } = keyToXY(playerKey);
				let adjCovered = false;
				for (let j = 0; j < CARDINAL_STEPS.length; j++) {
					const nk = xyKey(x + CARDINAL_STEPS[j][0], y + CARDINAL_STEPS[j][1]);
					if (building.floorKeys.has(nk) && !exposedFloorKeys.has(nk)) { adjCovered = true; break; }
				}
				_view.playerSheltered = adjCovered && !roofGone;
			}
			continue;
		}

		const roofTiles = roofTilesFromBuilding(
			building.floorKeys,
			building.doorKeys,
			building.wallKeys,
			exposedFloorKeys,
			1.0
		);
		for (let i = 0; i < roofTiles.length; i++) {
			const key = xyKey(roofTiles[i].x, roofTiles[i].y);
			const nearBurned = keyWithinRadius(key, burnedScoreKeys, 1);
			const nearActiveFire = keyWithinRadius(key, activeScoreKeys, 1);
			if (nearBurned) {
				roofTiles[i].kind = roofTiles[i].kind.includes("_charred")
					? roofTiles[i].kind
					: `${roofTiles[i].kind}_charred`;
				if (!nearActiveFire) {
					// Burned but no active fire — keep as damaged charred tile at reduced alpha
					roofTiles[i].alpha *= 0.45;
					if (keyWithinRadius(key, smolderingSeedKeys, 1)) {
						roofTiles[i].smoking = true;
					}
				}
			}
			if (nearActiveFire) {
				roofTiles[i].burning = true;
			}
			roofs.push(roofTiles[i]);
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
	for (const [, ws] of world.query(WeatherState)) {
		_view.weather = ws.current || "clear";
		break;
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
		const brain = world.get(_view.player.id, Brain);
		const eq = world.get(_view.player.id, Equipment);
		const radius = (brain?.visionRange ?? 8) + (eq?.visionRangeDerived ?? 0);
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
		const brain = world.get(_view.player.id, Brain);
		const eq2 = world.get(_view.player.id, Equipment);
		const radius = (brain?.visionRange ?? 8) + (eq2?.visionRangeDerived ?? 0);
		playerVisionRadius = radius;
		const viewR = (radius | 0) + 4;
		const x0 = _view.player.pos.x - viewR;
		const y0 = _view.player.pos.y - viewR;
		const x1 = _view.player.pos.x + viewR;
		const y1 = _view.player.pos.y + viewR;
		forEachInRect(world, x0, y0, x1, y1, (id, pos) => {
			if (world.has(id, PlasmaCloud) || world.has(id, HazardArea)) return;
			if (world.has(id, Burned)) return;
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
				rec = { id, kind, pos: { x: pos.x, y: pos.y }, tags: [], layer, hp: 0, maxHp: 0, isPet: false, showHealthBar: false };
				_entityRecs.set(id, rec);
			} else {
				rec.kind = kind;
				rec.layer = layer;
				rec.pos.x = pos.x; rec.pos.y = pos.y;
				rec.tags.length = 0;
			}

			// Project select status types into tags for display-only logic.
			projectDisplayTags(world, id, rec);
			projectEquipmentDisplayTags(world, id, rec);
			projectMonsterDefTags(kind, rec);
			projectItemAffixDisplayTags(kind, itemInfo, rec);
			projectCombatUi(world, id, rec, playerFactionKey);
			if (world.has(id, Flying) && !rec.tags.includes('flying')) rec.tags.push('flying');

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
				rec = { id, kind, pos: { x: pos.x, y: pos.y }, tags: [], layer, hp: 0, maxHp: 0, isPet: false, showHealthBar: false };
				_entityRecs.set(id, rec);
			} else {
				rec.kind = kind;
				rec.layer = layer;
				rec.pos.x = pos.x; rec.pos.y = pos.y;
				rec.tags.length = 0;
			}

			// Project select status types into tags for display-only logic.
			projectDisplayTags(world, id, rec);
			projectEquipmentDisplayTags(world, id, rec);
			projectMonsterDefTags(kind, rec);
			projectItemAffixDisplayTags(kind, itemInfo, rec);
			projectCombatUi(world, id, rec, '');
			if (world.has(id, Flying) && !rec.tags.includes('flying')) rec.tags.push('flying');

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
