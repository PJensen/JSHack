import { Effect } from '../../components/Effect.js';

// Update motion for float_text effects: integrate simple velocity with gentle upward lift and drag.
export function effectMotionSystem(world, dt){
  if (!dt || dt <= 0) return;
  // Base drag-per-frame at 60 FPS (closer to 1 = less drag). Allow per-effect override via d.dragPerFrame.
  const defaultDragPerFrame = 0.985;
  for (const [id, eff] of world.query(Effect)){
    if (!eff || eff.type !== 'float_text') continue;
    if (!eff.data) eff.data = {};
    if (!eff.pos) eff.pos = { x: 0, y: 0 };
    const d = eff.data;
    let vx = +d.vx || 0;
    let vy = +d.vy || 0;

    // Allow per-effect acceleration overrides; default to a small upward lift
    const ax = (typeof d.ax === 'number') ? d.ax : 0;
    const ay = (typeof d.ay === 'number') ? d.ay : -0.45;
    // Per-effect drag override
    const dragPerFrame = (typeof d.dragPerFrame === 'number' && d.dragPerFrame > 0 && d.dragPerFrame < 1)
      ? d.dragPerFrame
      : defaultDragPerFrame;
    const drag = Math.pow(dragPerFrame, dt * 60);

    // Integrate velocity
    vx += ax * dt;
    vy += ay * dt;

    // Integrate position in tile units
    eff.pos.x += vx * dt;
    eff.pos.y += vy * dt;

    // Apply drag to gradually slow motion
    vx *= drag;
    vy *= drag;

    d.vx = vx;
    d.vy = vy;

    // Mark changed so renderers depending on Changed(Effect) can react in some engines
    try { world.markChanged(id, Effect); } catch(_) { /* optional */ }
  }
}
