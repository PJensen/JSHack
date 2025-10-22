import { getRenderContext } from '../renderers/renderingUtils.js';
import { makeSingleton } from '../../lib/ecs/core.js';
import { DevState } from '../../components/DevState.js';

// Dev overlay: shows particle counts and lets you toggle quality with 'E'
export function effectDebugSystem(world){
  // DevState singleton holds debug flags
  const [_getCachedId, ensure] = makeSingleton(world, DevState);
  const devId = ensure();
  const dev = world.get(devId, DevState);
  // lazy attach key listener once per runtime using the dev flag
  if (!dev.effectDebugInit){
    // mark init in the component so it persists and is discoverable
    world.set(devId, DevState, { effectDebugInit: true });
    window.addEventListener('keydown', (ev) => {
      if (ev.key === 'e' || ev.key === 'E'){
        const order = ['low','medium','high'];
        const idx = order.indexOf((world.get(devId, DevState) || {}).effectQuality || 'high');
        const next = order[(idx+1) % order.length];
        world.set(devId, DevState, { effectQuality: next });
      }
    });
  }

  const rc = getRenderContext(world);
  if (!rc) return;
  const { ctx, cellH, canvas } = rc;

  ctx.save();
  ctx.font = `${Math.max(10, Math.round(cellH * 0.6))}px monospace`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  const pad = 6;
  const x = pad, y = pad;

  // background box
  const lines = [];
  const pcount = (rc && rc.particleSystem) ? (typeof rc.particleSystem.count === 'function' ? rc.particleSystem.count() : 0) : 0;
  lines.push(`particles: ${pcount}`);
  const quality = (world.get(devId, DevState) || {}).effectQuality || 'high';
  lines.push(`quality: ${quality} (press E)`);

  const lineH = Math.round(cellH * 0.8);
  const boxH = lines.length * lineH + pad*2;
  const boxW = 160;
  ctx.fillRect(x - pad, y - pad, boxW, boxH);

  ctx.fillStyle = '#fff';
  for (let i=0;i<lines.length;i++){
    ctx.fillText(lines[i], x, y + i * lineH);
  }
  ctx.restore();
}
