// bridge/schema/worldView.js
// Build a minimal, stable WorldView DTO for display.

import { Position } from "../../rules/components/Position.js";
import { Player } from "../../rules/components/Player.js";
import { NamedIdentity } from "../../rules/components/NamedIdentity.js";

export function buildWorldView(world) {
	const view = {
		turn: world.step | 0,
		seed: world.seed >>> 0,
		player: null,
		entities: [],
	};

	for (const [id, pos] of world.query(Position)) {
		const isPlayer = world.has(id, Player);
		const ident = world.get(id, NamedIdentity);
		const kind = isPlayer ? "player" : (ident?.identity || ident?.name || "default");
		const rec = { id, kind, pos: { x: pos.x, y: pos.y }, tags: [] };
		view.entities.push(rec);
		if (isPlayer) view.player = { id, pos: { x: pos.x, y: pos.y } };
	}
	return view;
}

