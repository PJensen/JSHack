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
import { getTile, forEachTileInRect } from '../../rules/environment/dungeon/tileMap.js';
import { Brain } from '../../rules/components/Brain.js';
import { buildBlocksVisionMap, blockedCallback } from '../../rules/utils/vision.js';
import { updateFOV, isVisible, isExplored } from '../../rules/environment/dungeon/exploredMap.js';
import { forEachInRect, ensureSpatialIndex } from '../../rules/utils/spatialIndex.js';
import { Engraving } from '../../rules/components/Engraving.js';
import { PlasmaCloud } from "../../rules/components/PlasmaCloud.js";
import { HazardArea } from "../../rules/components/HazardArea.js";

// Reuse view/record objects across frames to reduce allocations/GC churn.
/** @typedef {{ id:number, kind:string, pos:{x:number,y:number}, tags:string[], layer:number }} EntityView */
/** @typedef {{ id:number, x:number, y:number }} SolidView */
/** @typedef {{ turn:number, seed:number, player: { id:number, pos:{x:number,y:number} } | null, entities: EntityView[], solids: SolidView[], emissives: any[], tileGrid: any, isVisible: ((x:number,y:number)=>boolean)|null, isExplored: ((x:number,y:number)=>boolean)|null }} WorldView */

/** @typedef {{ id:number, text:string, pos:{x:number,y:number} }} EngravingView */

/** @type {WorldView} */
const _view = { turn: 0, seed: 0, player: null, entities: [], solids: [], emissives: [], engravings: [], tileGrid: null, isVisible: null, isExplored: null };
/** @type {Map<number, EntityView>} */
const _entityRecs = new Map();   // id -> { id, kind, pos:{x,y}, tags:[] }
/** @type {Map<number, SolidView>} */
const _solidRecs = new Map();    // id -> { id, x, y }

/** @type {EntityView[]} reusable temp buffer for entity collection before FOV filter */
const _allEntities = [];
let _lastFovStep = -1;

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
	_view.engravings.length = 0;
	_allEntities.length = 0;

	// Expose tile grid functions for direct grid-based rendering
	_view.tileGrid = { getTile, forEachTileInRect };

	for (const [id, _p, pos] of world.query(Player, Position)) {
		_view.player = { id, pos: { x: pos.x, y: pos.y } };
		break;
	}

	// Compute FOV (once per turn, idempotent via step check in updateFOV)
	if (_view.player) {
		if (_view.turn !== _lastFovStep) {
			_lastFovStep = _view.turn;
			const brain = world.get(_view.player.id, Brain);
			const radius = brain?.visionRange ?? 10;
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
	}

	_view.isVisible = isVisible;
	_view.isExplored = isExplored;

	// Collect entity records near the player (or all if no player).
	if (_view.player) {
		ensureSpatialIndex(world);
		const brain = world.get(_view.player.id, Brain);
		const radius = brain?.visionRange ?? 10;
		const viewR = (radius | 0) + 4;
		const x0 = _view.player.pos.x - viewR;
		const y0 = _view.player.pos.y - viewR;
		const x1 = _view.player.pos.x + viewR;
		const y1 = _view.player.pos.y + viewR;
		forEachInRect(world, x0, y0, x1, y1, (id, pos) => {
			if (world.has(id, PlasmaCloud) || world.has(id, HazardArea)) return;
			const isPlayer = _view.player && id === _view.player.id;
			/** @type {any} */ const ident = /** @type any */ (world.get(id, NamedIdentity));
			/** @type {any} */ const door = /** @type any */ (world.get(id, DoorState));
			/** @type {any} */ const col = /** @type any */ (world.get(id, Collider));
			/** @type {any} */ const itemInfo = /** @type any */ (world.get(id, ItemInfo));

			let kind = "default";
			if (door) {
				kind = door.open ? "door_open" : "door_closed";
			} else if (isPlayer) {
				kind = "player";
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
				rec = { id, kind, pos: { x: pos.x, y: pos.y }, tags: [], layer };
				_entityRecs.set(id, rec);
			} else {
				rec.kind = kind;
				rec.layer = layer;
				rec.pos.x = pos.x; rec.pos.y = pos.y;
				rec.tags.length = 0;
			}

			// Project select status types into tags for display-only logic
			/** @type {any} */ const stat = /** @type any */ (world.get(id, Status));
			if (stat && Array.isArray(stat.statuses)) {
				for (let i = 0; i < stat.statuses.length; i++) {
					const s = stat.statuses[i];
					const t = String(s.type || '').toLowerCase();
					if (!t) continue;
					if (t === 'invulnerable' || t === 'stunned' || t === 'poisoned' || t === 'burning' || t === 'regen' || t === 'thorns' || t === 'disease' || t === 'bleeding' || t === 'satiated' || t === 'peckish' || t === 'hungry' || t === 'famished' || t === 'starving' || t === 'wasting') {
						rec.tags.push(t);
					}
				}
			}

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
			const isPlayer = world.has(id, Player);
			/** @type {any} */ const ident = /** @type any */ (world.get(id, NamedIdentity));
			/** @type {any} */ const door = /** @type any */ (world.get(id, DoorState));
			/** @type {any} */ const col = /** @type any */ (world.get(id, Collider));
			/** @type {any} */ const itemInfo = /** @type any */ (world.get(id, ItemInfo));

			let kind = "default";
			if (door) {
				kind = door.open ? "door_open" : "door_closed";
			} else if (isPlayer) {
				kind = "player";
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
				rec = { id, kind, pos: { x: pos.x, y: pos.y }, tags: [], layer };
				_entityRecs.set(id, rec);
			} else {
				rec.kind = kind;
				rec.layer = layer;
				rec.pos.x = pos.x; rec.pos.y = pos.y;
				rec.tags.length = 0;
			}

			// Project select status types into tags for display-only logic
			/** @type {any} */ const stat = /** @type any */ (world.get(id, Status));
			if (stat && Array.isArray(stat.statuses)) {
				for (let i = 0; i < stat.statuses.length; i++) {
					const s = stat.statuses[i];
					const t = String(s.type || '').toLowerCase();
					if (!t) continue;
					if (t === 'invulnerable' || t === 'stunned' || t === 'poisoned' || t === 'burning' || t === 'regen' || t === 'thorns' || t === 'disease' || t === 'bleeding' || t === 'satiated' || t === 'peckish' || t === 'hungry' || t === 'famished' || t === 'starving' || t === 'wasting') {
						rec.tags.push(t);
					}
				}
			}

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
		if (isVisible(rec.pos.x, rec.pos.y)) {
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
			_view.engravings.push({ id, text: eng.text, pos: { x: pos.x, y: pos.y } });
		}
	}

	return _view;
}
