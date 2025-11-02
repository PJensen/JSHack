// bridge/schema/worldView.js
// Build a minimal, stable WorldView DTO for display.

import { Position } from "../../rules/components/Position.js";
import { Player } from "../../rules/components/Player.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";
import { Terrain } from "../../rules/components/Terrain.js";
import { DoorState } from "../../rules/components/DoorState.js";
import { Collider } from "../../rules/components/Collider.js";
import { Status } from "../../rules/components/Status.js";

export function buildWorldView(world) {
	const view = {
		turn: world.step | 0,
		seed: world.seed >>> 0,
		player: null,
		entities: [],
		solids: [],
		emissives: [],
	};

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

			const rec = { id, kind, pos: { x: pos.x, y: pos.y }, tags: [] };
			// Project select status types into tags for display-only logic
			const stat = world.get(id, Status);
			if (stat && Array.isArray(stat.statuses)) {
				for (const s of stat.statuses) {
					const t = String(s.type || '').toLowerCase();
					if (!t) continue;
					// Whitelist: only expose a small set as tags to keep display contract tidy
					if (t === 'invulnerable' || t === 'stunned' || t === 'poisoned' || t === 'burning' || t === 'regenerating') {
						rec.tags.push(t);
					}
				}
			}
		view.entities.push(rec);
		if (isPlayer) view.player = { id, pos: { x: pos.x, y: pos.y } };

		// solids list for display/collision readers
		if ((terrain && !terrain.walkable) || (col && col.solid)) {
			view.solids.push({ id, x: pos.x, y: pos.y });
		}
	}
	return view;
}

