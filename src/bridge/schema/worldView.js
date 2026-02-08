// bridge/schema/worldView.js
// Build a minimal, stable WorldView DTO for display.

import { Position } from "../../rules/components/Position.js";
import { Player } from "../../rules/components/Player.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { Terrain } from "../../rules/components/Terrain.js";
import { DoorState } from "../../rules/components/DoorState.js";
import { Collider } from "../../rules/components/Collider.js";
import { Status } from "../../rules/components/Status.js";
import { Equipment } from "../../rules/components/Equipment.js";
import { ItemInfo } from "../../rules/components/ItemInfo.js";

// Reuse view/record objects across frames to reduce allocations/GC churn.
/** @typedef {{ id:number, kind:string, pos:{x:number,y:number}, tags:string[] }} EntityView */
/** @typedef {{ id:number, x:number, y:number }} SolidView */
/** @typedef {{ turn:number, seed:number, player: { id:number, pos:{x:number,y:number} } | null, entities: EntityView[], solids: SolidView[], emissives: any[] }} WorldView */

/** @type {WorldView} */
const _view = { turn: 0, seed: 0, player: null, entities: [], solids: [], emissives: [] };
/** @type {Map<number, EntityView>} */
const _entityRecs = new Map();   // id -> { id, kind, pos:{x,y}, tags:[] }
/** @type {Map<number, SolidView>} */
const _solidRecs = new Map();    // id -> { id, x, y }

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
	// emissives left as future use; keep empty
	_view.emissives.length = 0;

	for (const [id, pos] of world.query(Position)) {
		const isPlayer = world.has(id, Player);
		/** @type {any} */ const ident = /** @type any */ (world.get(id, NamedIdentity));
		/** @type {any} */ const terrain = /** @type any */ (world.get(id, Terrain));
		/** @type {any} */ const door = /** @type any */ (world.get(id, DoorState));
		/** @type {any} */ const col = /** @type any */ (world.get(id, Collider));

		let kind = "default";
		if (terrain) {
			kind = terrain.walkable ? "floor" : "wall";
		}
		if (door) {
			kind = door.open ? "door_open" : "door_closed";
		}
		if (isPlayer) {
			kind = "player";
		} else if (!terrain && !door) {
			// fall back to identity for creatures/items
			kind = ident?.identity || ident?.name || "default";
		} else if (terrain && ident && ident.identity && ident.identity !== "default") {
			// Terrain entities with explicit identity (stairs, special tiles)
			kind = ident.identity;
		}

		/** @type {EntityView|null} */
		let rec = /** @type any */ (_entityRecs.get(id) || null);
		if (!rec) {
			rec = { id, kind, pos: { x: pos.x, y: pos.y }, tags: [] };
			_entityRecs.set(id, rec);
		} else {
			rec.kind = kind;
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
				// Whitelist: only expose a small set as tags to keep display contract tidy
				if (t === 'invulnerable' || t === 'stunned' || t === 'poisoned' || t === 'burning' || t === 'regenerating' || t === 'thorns') {
					rec.tags.push(t);
				}
			}
		}

		// Project simple equipment-derived tags (display-only), e.g., 'thorns' when wearing thorned armor
		// No gear-based tag injection; thorns will appear via Status when it procs

		_view.entities.push(rec);
		if (isPlayer) {
			if (!_view.player) _view.player = { id, pos: { x: pos.x, y: pos.y } };
			else { _view.player.id = id; _view.player.pos.x = pos.x; _view.player.pos.y = pos.y; }
		}

		// solids list for display/collision readers
		if ((terrain && !terrain.walkable) || (col && col.solid)) {
			let srec = _solidRecs.get(id);
			if (!srec) { srec = { id, x: pos.x, y: pos.y }; _solidRecs.set(id, srec); }
			else { srec.x = pos.x; srec.y = pos.y; }
			_view.solids.push(srec);
		}
	}
	return _view;
}

