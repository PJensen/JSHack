import { Effect } from '../components/Effect.js';

// Convenience helper to spawn common effects
export function spawnFloatText(world, x, y, text, opts={}){
  const e = world.create();
  const life = opts.life || 0.9;
  const scaleBase = opts.crit ? 1.3 : 1.0;
  const dmg = opts.dmg || 0;
  const magScale = dmg ? Math.min(2.2, 0.7 + dmg / 10) : 1;
  const scaleStart = opts.scaleStart || (scaleBase * magScale);
  const scaleEnd = opts.scaleEnd || (0.75 * scaleBase);
  world.add(e, Effect, {
    type: 'float_text',
    ttl: life,
    ttlMax: life,
    pos: { x, y },
    data: {
      text: String(text),
      color: opts.color || '#ffffff',
      vx: opts.vx || (Math.random()*0.4 - 0.2),
      vy: opts.vy || (-0.8 - Math.random()*0.3),
      scaleStart,
      scaleEnd,
      batch: opts.batch || false,
      value: (/^[-+]?\d+$/.test(String(text)) ? parseInt(text,10) : null),
      sign: (String(text).startsWith('-')? -1 : 1),
      justSpawned: true
    },
    layer: opts.layer || 'top',
    priority: opts.priority || 0
  });
  return e;
}
