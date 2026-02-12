// src/rules/systems/petFollowSystem.js
// Pets follow the player each tick, staying within 2 tiles.
// If the pet is very far away (e.g. floor transition), it teleports nearby.

import { Position } from "../components/Position.js";
import { Pet } from "../components/Pet.js";
import { Player } from "../components/Player.js";
import { MoveIntent } from "../components/Intents/MoveIntent.js";

const FOLLOW_DISTANCE = 2;  // start following when farther than this
const TELEPORT_DISTANCE = 10; // teleport if farther than this

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function petFollowSystem(world) {
  // Find player position
  let playerPos = null;
  for (const [id, _p, pos] of world.query(Player, Position)) {
    playerPos = { x: pos.x, y: pos.y };
    break;
  }
  if (!playerPos) return;

  for (const [id, _pet, pos] of world.query(Pet, Position)) {
    const dx = playerPos.x - pos.x;
    const dy = playerPos.y - pos.y;
    const dist = Math.abs(dx) + Math.abs(dy); // Manhattan distance

    // Teleport if too far (floor transition, etc.)
    if (dist > TELEPORT_DISTANCE) {
      world.set(id, Position, { x: playerPos.x + 1, y: playerPos.y });
      continue;
    }

    // Already close enough — stay put
    if (dist <= FOLLOW_DISTANCE) continue;

    // Move one step toward the player
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    let mx = 0, my = 0;
    if (ax >= ay) { mx = Math.sign(dx); } else { my = Math.sign(dy); }

    if ((mx | my) === 0) continue;

    if (!world.has(id, MoveIntent)) {
      try { world.add(id, MoveIntent, { dx: mx, dy: my }); } catch {}
    }
  }
}
