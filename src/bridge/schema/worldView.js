// bridge/schema/worldView.js
// Build a minimal, stable WorldView DTO for display.

import { Position } from "../../rules/components/Position.js";
import { Player } from "../../rules/components/Player.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { Terrain } from "../../rules/components/Terrain.js";
import { DoorState } from "../../rules/components/DoorState.js";
import { Collider } from "../../rules/components/Collider.js";
import { Status } from "../../rules/components/Status.js";

// Reuse view/record objects across frames to reduce allocations/GC churn.
const _view = { turn: 0, seed: 0, player: null, entities: [], solids: [], emissives: [] };
const _entityRecs = new Map();   // id -> { id, kind, pos:{x,y}, tags:[] }
const _solidRecs = new Map();    // id -> { id, x, y }

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
		const ident = world.get(id, NamedIdentity);
		const terrain = world.get(id, Terrain);
		const door = world.get(id, DoorState);
		const col = world.get(id, Collider);

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
		}

		let rec = _entityRecs.get(id);
		if (!rec) {
			rec = { id, kind, pos: { x: pos.x, y: pos.y }, tags: [] };
			_entityRecs.set(id, rec);
		} else {
			rec.kind = kind;
			rec.pos.x = pos.x; rec.pos.y = pos.y;
			rec.tags.length = 0;
		}

		// Project select status types into tags for display-only logic
		const stat = world.get(id, Status);
		if (stat && Array.isArray(stat.statuses)) {
			for (let i = 0; i < stat.statuses.length; i++) {
				const s = stat.statuses[i];
				const t = String(s.type || '').toLowerCase();
				if (!t) continue;
				// Whitelist: only expose a small set as tags to keep display contract tidy
				if (t === 'invulnerable' || t === 'stunned' || t === 'poisoned' || t === 'burning' || t === 'regenerating') {
					rec.tags.push(t);
				}
			}
		}

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

