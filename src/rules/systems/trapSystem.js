import { Position } from "../components/Position.js";
import { Trap } from "../components/Trap.js";
import { Vitality } from "../components/Vitality.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { runScript, ScriptVerb } from "../scripting.js";

/** @param {import('../../lib/ecs-js/index.js').World} world */
export function trapSystem(world) {
  // Check armed traps — trigger when any living entity is on the same tile
  for (const [tid, tpos, t] of world.query(Position, Trap)) {
    if (!tpos || !t || !t.armed) continue;

    // Find the first living entity standing on this trap
    let victimId = 0;
    for (const [id, pos] of world.query(Position, Vitality)) {
      if (!pos || id === tid) continue;
      if (pos.x === tpos.x && pos.y === tpos.y) {
        victimId = id;
        break;
      }
    }
    if (!victimId) continue;

    // Reveal and name before triggering so logs show source
    const ident = world.get(tid, NamedIdentity);
    if (!ident) {
      const trapNames = { spike: 'Spike Trap', snake: 'Snake Trap', shock: 'Shock Trap' };
      const name = trapNames[t.type] || 'Trap';
      const identity = 'trap_' + (t.type || 'spike');
      try { world.add(tid, NamedIdentity, { name, identity }); } catch {} // ECS: may already exist
    }

    // Notify display layer
    try { world.emit('trap:triggered', { trapId: tid, victimId, type: t.type }); } catch {}

    // Run scripted behavior
    const scriptKey = t.script || (t.type === 'spike' ? 'trap_spike' : '');
    if (scriptKey) {
      runScript(scriptKey, ScriptVerb.TrapTrigger, world, {
        trapId: tid,
        targetId: victimId,
        trap: t,
        params: t.params || {},
      });
    }

    // Reveal and disarm
    try { world.set(tid, Trap, { ...t, revealed: true, armed: false }); } catch {} // ECS: component may not exist
  }
}
