// Health Bar DOM System: updates the CSS HUD element (#hpFill) and label (#hpLabel)
// READONLY: only reads ECS data and writes DOM attributes/styles
import { RenderContext } from '../../components/RenderContext.js';
import { Player } from '../../components/Player.js';
import { Health } from '../../components/Health.js';

let cached = null; // cache DOM refs across frames

export function healthBarDomSystem(world){
  const rcId = world.renderContextId; if (!rcId) return;
  const rc = world.get(rcId, RenderContext); if (!rc) return;

  // Query player health
  let hp = 0, maxHp = 0;
  for (const [id, h] of world.query(Health, Player)){
    hp = Math.max(0, h.hp|0);
    maxHp = Math.max(1, h.maxHp|0);
    break; // assume single player
  }

  // Lazy DOM lookup and cache
  if (!cached || !cached.hpFill || !cached.hpLabel){
    const doc = (typeof document !== 'undefined') ? document : null;
    if (!doc) return;
    cached = {
      hpFill: doc.getElementById('hpFill') || null,
      hpLabel: doc.getElementById('hpLabel') || null,
    };
  }
  const el = cached.hpFill; const label = cached.hpLabel;
  if (!el) return;

  const pct = (maxHp > 0) ? Math.max(0, Math.min(1, hp / maxHp)) : 0;
  // Update fill via CSS variable used by index.css (width: var(--pct))
  try {
    el.style.setProperty('--pct', (pct * 100).toFixed(1) + '%');
    // optional: subtle saturation/brightness feedback with health amount
    el.style.filter = `saturate(${(0.7 + pct*0.5).toFixed(2)}) brightness(${(0.75 + pct*0.35).toFixed(2)})`;
  } catch(_) { /* ignore style failures */ }

  // Label text (fallback if element missing is to silently skip)
  if (label){
    label.textContent = `HP ${hp}/${maxHp}`;
    label.setAttribute('aria-valuenow', String(hp));
    label.setAttribute('aria-valuemax', String(maxHp));
  }
}
