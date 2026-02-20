import { Position } from "../components/Position.js";
import { Player } from "../components/Player.js";
import { Trap } from "../components/Trap.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { runScript, ScriptVerb } from "../scripting.js";

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function trapSystem(world) {
  // Find the player
  let playerId = 0;
  let playerPos = null;
  for (const [id, pos] of world.query(Position, Player)) {
    if (!pos) continue;
    playerId = id;
    playerPos = pos;
    break;
  }
  if (!playerId || !playerPos) return;

  // Check armed traps — trigger when player is on the same tile
  for (const [tid, tpos, t] of world.query(Position, Trap)) {
    if (!tpos || !t) continue;
    if (!t.armed) continue;

    // Grid check: same integer tile
    if (tpos.x !== playerPos.x || tpos.y !== playerPos.y) continue;

    // Reveal and name before triggering so logs show source
    const ident = world.get(tid, NamedIdentity);
    if (!ident) {
      const trapNames = { spike: 'Spike Trap', snake: 'Snake Trap', shock: 'Shock Trap' };
      const name = trapNames[t.type] || 'Trap';
      const identity = 'trap_' + (t.type || 'spike');
      try { world.add(tid, NamedIdentity, { name, identity }); } catch {}
    }

    // Run scripted behavior
    const scriptKey = t.script || (t.type === 'spike' ? 'trap_spike' : '');
    if (scriptKey) {
      runScript(scriptKey, ScriptVerb.TrapTrigger, world, {
        trapId: tid,
        targetId: playerId,
        trap: t,
        params: t.params || {},
      });
    }

    // Reveal and disarm
    try { world.set(tid, Trap, { ...t, revealed: true, armed: false }); } catch {}
  }
}
