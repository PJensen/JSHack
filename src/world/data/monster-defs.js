// src/data/monster-defs.js
// Export MONSTER_DEFS taken from the reference implementation, extended with callbacks.
import { Hallucination } from '../components/Hallucination.js';
import { Player } from '../components/Player.js';
import { Position } from '../components/Position.js';
import { spawnFloatText } from '../systems/effects/spawner.js';
import { ftPreset } from '../systems/effects/floatTextPresets.js';

export const MONSTER_DEFS = [
  { name: 'Grid Bug', glyph: 'x', fg: '#0d96f7ff', maxHp: 2, attack: 3, defense: 0,

    onDeath(world, monsterId, killerId){
      try {
        if (!world || !world.has) return;
        // Apply any death effects or callbacks here
      } catch(_) { /* ignore errors */ }
    }
  },
  {
    name: 'Kobold', glyph: 'k', fg: '#c5a45b', maxHp: 6, attack: 1, defense: 0,
    // Extensible on-hit behavior as a callback; runs only if combat resolves a hit.
    onHit(world, attackerId, targetId){
      try{
        if (!world || !world.has || !world.rand) return;
        // Apply only to the player
        if (!world.has(targetId, Player)) return;
        // 10% chance
        const r = typeof world.rand === 'function' ? world.rand() : Math.random();
        if (r > 0.1) return;
        // Apply or refresh Hallucination with the provided flavor
        const params = {
          onsetSec: 2.0,
          sustainSec: 6.0,
          comedownSec: 4.0,
          strength: 1.0,
          hueMaxDeg: 120,
          saturationBoost: 1.8,
          aberrationMaxPx: 6,
          wobbleAmpPx: 2.5,
          wobbleFreqHz: 1.3,
          vignetteStrength: 0.35,
          kaleidoAt: 0.7,
          trailAlpha: 0.0,
          loop: false
        };
        if (!world.has(targetId, Hallucination)){
          world.add(targetId, Hallucination, params);
        } else {
          const cur = world.get(targetId, Hallucination);
          const next = Object.assign({}, params);
          next.t = 0; // refresh timeline
          // gentle stacking: bump strength slightly, cap at 1.0 unless explicitly set
          if (typeof next.strength !== 'number'){
            const s = Math.max(0, Math.min(1, (cur?.strength ?? 1.0)));
            next.strength = Math.min(1.0, s + 0.1);
          }
          world.set(targetId, Hallucination, next);
        }
        // Visual confirmation: float text near the player
        try{
          const p = world.get(targetId, Position);
          if (p) spawnFloatText(world, p.x, p.y, ftPreset('Pop', { text: 'Hallucinating!', color: '#b08cff' }));
        }catch(_){ }
      }catch(_){ /* ignore to keep combat hot path safe */ }
    }
  },
  { name: 'Orc', glyph: 'o', fg: '#6bb2d9', maxHp: 10, attack: 4, defense: 1 },
  { name: 'Slime', glyph: 's', fg: '#57d5c4', maxHp: 8, attack: 2, defense: 0 }
];

export default MONSTER_DEFS;
