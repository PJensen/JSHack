import { Position } from "../components/Position.js";
import { Player } from "../components/Player.js";
import { Trap } from "../components/Trap.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { BoundingCircle } from "../components/BoundingCircle.js";
import { runScript, ScriptVerb } from "../scripting.js";

const EPS = 1e-6;

// Trigger traps when the player steps onto them. Keep traps hidden until triggered.
// Simple behavior for 'spike': apply flat damage once and reveal.
/** @param {import('../../lib/ecs-js').World} world */
export function trapSystem(world) {
  // Find the player (single player assumption)
  let playerId = 0;
  let playerPos = null;
  let playerRadius = 0.5;
  for (const [id, pos] of world.query(Position, Player)) {
    if (!pos) continue;
    playerId = id;
    playerPos = pos;
    playerRadius = Math.max(0, world.get(id, BoundingCircle)?.radius ?? 0.5);
    break;
  }
  if (!playerId || !playerPos) return;

  // Iterate traps that are armed
  for (const [tid, tpos, t] of world.query(Position, Trap)) {
    if (!tpos || !t) continue;
    if (!t.armed) continue;
    // Hidden traps have no render identity; reveal only on trigger

    // Trigger threshold: center-to-center less than player radius (stepping onto tile center)
    const dx = Math.abs(tpos.x - playerPos.x);
    const dy = Math.abs(tpos.y - playerPos.y);
    // Consider within tile overlap (player grid centers are at n+0.5)
    if (dx > 0.8 || dy > 0.8) continue;

    // Name and reveal before triggering so logs show source name
    const ident = world.get(tid, NamedIdentity);
    if (!ident) {
      const name = t.type === 'spike' ? 'Spike Trap' : 'Trap';
      try { world.add(tid, NamedIdentity, { name, identity: 'trap_spike' }); } catch {}
    }
    // Run scripted behavior
    const scriptKey = t.script || (t.type === 'spike' ? 'trap_spike' : '');
    if (scriptKey) {
      runScript(scriptKey, ScriptVerb.TrapTrigger, world, { trapId: tid, targetId: playerId, trap: t, params: t.params || {} });
    }

    // Reveal and disarm
    try { world.set(tid, Trap, { ...t, revealed: true, armed: false }); } catch {}
  }
}
