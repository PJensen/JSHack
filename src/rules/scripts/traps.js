import { registerScript, ScriptVerb } from "../scripting.js";
import { Vitality } from "../components/Vitality.js";
import { Position } from "../components/Position.js";

// Spike trap: deals percentage of max HP as damage.
// Params: { percent?: number } // 0..1
registerScript('trap_spike', {
  [ScriptVerb.TrapTrigger]: (world, ctx) => {
    const target = Number(ctx?.targetId || 0) || 0;
    if (!world.isAlive(target)) return;
    const vit = world.get(target, Vitality);
    if (!vit) return;
    const pos = world.get(target, Position);
    const pct = Math.max(0, Math.min(1, Number(ctx?.params?.percent ?? 0.2)));
    const amount = Math.max(1, Math.floor(vit.maxHp * pct));
    vit.hp = Math.max(0, vit.hp - amount);
    try { world.emit && world.emit('damaged', { target, amount, source: Number(ctx?.trapId || 0) || 0, at: pos ? { x: pos.x, y: pos.y } : undefined }); } catch {}
    if (vit.hp <= 0) {
      try { world.emit && world.emit('died', { id: target, killer: Number(ctx?.trapId || 0) || 0 }); } catch {}
    }
  }
});
