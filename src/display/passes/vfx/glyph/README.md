# Glyph VFX (engine-side)

This folder contains the engine-side support for overlaying high-fidelity visual effects on top of already-rendered glyphs.

- `glyph_vfx.js`: envelope parity with the FX Builder (onset/steady/comedown in ms, easing, hold-steady), plus a `GlyphVfxManager` to host and render multiple overlay effects.
- `effects/`: individual, envelope-aware overlay functions (do not render the base glyph).
- `bridgeActiveEffects.js`: a simple bridge from rules-side `ActiveEffects` to display-side VFX using the manager.

## Integration sketch

```js
import { GlyphVfxManager } from './glyph_vfx.js';
import { bridgeActiveEffectsForWorld } from './bridgeActiveEffects.js';

const vfx = new GlyphVfxManager({ envelopeDefaults: { onsetMs:200, steadyMs:0, comedownMs:200, easing:'quad', holdSteady:true } });

function renderFrame(ctx, world, nowSec){
  // 1) Base pass draws glyphs normally
  drawBaseGlyphs(ctx, world);
  // 2) Update and render overlays
  vfx.update(nowSec);
  bridgeActiveEffectsForWorld(world, vfx, nowSec);
  vfx.render(ctx);
}
```

## Authoring

Write overlay FX as `(ctx, glyph, x, y, size, t, dt, seed, baselineY, env, opts?) => void` and multiply intensities by `env.gain`. See `effects/neonPulse.js` and `effects/aegisWard.js` for patterns. The base glyph should be drawn in the normal pass, not inside the effect.
