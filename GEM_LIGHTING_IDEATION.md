# Gem Lighting × Materials — Ideation Log
_Started: 2026-04-16_

## Why This Matters

This is the **first light-materials interaction** in the engine. Every decision
here sets the pattern for how all future material-aware lighting works (metal
sheen, lava glow, wet stone, bioluminescent ooze, etc.). Get the architecture
right and everything else falls out of it naturally.

---

## Core Design Principle

**Real gems do not emit light. Full stop.**

Natural gems are pure light transformers. In darkness: nothing. Near a torch:
the gem wakes — caustics, glints, color spill, absorption. The torch reveals
the gem's character. Different sources produce different responses. This is
the interaction-only model.

Emission is reserved for:
- **Magical gems** — enchanted, cursed, blessed (future, tag-gated)
- **Voidstone** — intrinsic darkness aura (magical, not physical)
- **Fluorite** — real-world fluorescence is a narrow earned exception if desired

`gem_glowing` tag: **removed from natural gems entirely.**  
Natural gems are identified in the sources layer solely by presence of `e.gemOptical`.

---

## Light-Material Interaction

External light (torch, lantern, player glow) hits a gem. The gem's optical
properties transform that incoming light:

| Property | Effect |
|----------|--------|
| `lightPass` | **Caustic projection** — light bends through gem, pools on far side. Tinted by gem palette color. Diamond → cold white caustic 2.7 tiles wide. Amber → warm orange puddle. Turquoise → almost nothing (lightPass 0.10). |
| `lightReflect` | **Specular glint** — hard bright point at gem position. Diamond (0.17) glitters. Amber (0.07) barely registers. |
| `lightAbsorb` | **Absorption shadow** — high-absorb gems void nearby light *proportional to source proximity*. Dark in darkness (nothing to eat). Dims visibly when source is close. |
| palette color | **Color filter** — caustic and emission tinted by gem's material. Emerald → green caustic. Ruby → red spill. |

Gem in darkness = invisible, inert. Gem in torchlight = alive.  
This makes torches meaningful. Makes gem discovery a visual moment.

---

## Architectural Implication

No emission pass. One pass: **interaction only.**

Sources layer flow:
1. Entity loop: collect gems with `e.gemOptical` into `gemInteractors[]` (no emission)
2. After loop: snapshot `baseLightCount = out.length`
3. For each gem: scan `out[0..baseLightCount-1]` for nearby positive sources
4. Per nearby source: emit caustic + glint
5. Once per gem if any nearby source: absorption shadow (if `lightAbsorb > 0.5`)

No base glow emitted at all for natural gems. Pure response to incoming light.

Option A confirmed — two-pass within `collectLightSources`, no new files.

---

## Caustic Projection (Interaction Detail)

When a light source `S` is within range of gem `G`:

```
causticDir = normalize(G.pos - S.pos)          // away from source
causticPos = G.pos + causticDir * 1.5          // projected ~1.5 tiles behind gem
causticRadius = mat.lightPass * 3.0            // diamond → 2.76, amber → 1.65
causticColor = tintColor(S.color, mat.tint)    // source color filtered by gem
causticSoftness = 2                            // tight — caustics are sharp
causticIntensity = mat.lightPass * S.intensity // attenuated by transmissivity
```

Emit as a short-radius hard point light at `causticPos`. One per nearby source,
up to `MAX_CAUSTIC_SOURCES = 2` (performance cap).

High `lightPass` gems (diamond, beryl, topaz) project strong caustics.
Low `lightPass` gems (turquoise, jet) project nothing or near-nothing.

## Specular Glint (Interaction Detail)

When a source is within glint range (4 tiles):

```
glintRadius = mat.lightReflect * 2.5           // diamond → 0.42, amber → 0.17
glintColor = [255, 255, 255]                   // specular is always white-ish
glintSoftness = 1                              // very hard point
```

Only meaningful for high-reflectivity gems. Diamond, zircon, chrysoberyl.
Amber, garnet, turquoise: effectively nothing (glintRadius too small to notice).

Implemented as a very small, very hard point light at the gem position — the
"star" you see on a cut diamond in light.

## Absorption Shadow (Interaction Detail)

When `lightAbsorb >= 0.5` and a source is within 5 tiles:

```
shadowIntensity = mat.lightAbsorb * 0.6        // jet → 0.55, turquoise → 0.11
```

Emit a small void light at gem position scaled by absorption. Jet eats nearby
light visibly. Turquoise barely dims. This is the `emitVoid` path.

---

## Current State (verified by code read)

```
rules/data/materials.js     → lightPass, lightReflect, lightAbsorb, lightEmit
                               getMaterialIntrinsic(kind) → Material object ✓ exported
rules/data/gems.js          → { id, material: 'diamond' | 'corundum' | ... }
                               getGem(id) ✓ exported
bridge/schema/worldView.js  → only emits gem_glowing tag, no material data
                               already imports from rules freely — adding 2 imports is clean
display/lighting/sources/   → tag → fixed radius=3, softness=6, breathe pattern
  emitPatterned(out, pattern, t, id, x, y, baseRadius, baseColor, softness) ✓
  emitVoid(out, t, id, x, y, radius, strength, softness) ✓
  Available patterns: torch, ember, breathe, occult, pulse, storm, biolum,
                      heartbeat, candle, holy, void
  NO shimmer. NO steady. Unknown pattern → intensity=1, no shift (= steady fallback)
  Entity loop: lines 234–367. Gaze beams: line 369+.
  Gem block: lines 343–347 (if gem_glowing → fixed breathe)
```

Material science exists. Bridge drops it on the floor. Display is blind.

## Pattern Mapping (final — based on available patterns)

| Material      | Pattern    | Rationale |
|---------------|------------|-----------|
| diamond       | `holy`     | Closest to steady — barely moves, cold confidence |
| corundum      | `breathe`  | Ruby/sapphire: slow deep pulse |
| beryl         | `breathe`  | Emerald/aquamarine: organic pulse |
| zircon        | `pulse`    | High dispersion — metronome flash (shimmer not available) |
| topaz         | `candle`   | Warm slight drift |
| chrysoberyl   | `pulse`    | Chatoyancy: on/off directional glint |
| opal          | `biolum`   | Play-of-color: chaotic iridescent shift |
| fluorite      | `biolum`   | Actual fluorescence — eerie cold blue-green |
| garnet        | `breathe`  | Deep slow pulse |
| turquoise     | `breathe`  | Matte opaque, slow |
| amber         | `candle`   | Warm organic |
| quartz        | `breathe`  | Neutral |
| glass         | `breathe`  | Same as quartz, dimmer radius |
| gemstone      | `breathe`  | Catch-all (dilithium) |

## Void / Shadow Gems

`shadow_glowing` = **magical intrinsic darkness aura**, not a physics property.

- **Voidstone**: keeps `shadow_glowing` — it's a magical artifact, not a mineral
- **Jet, obsidian**: natural stones. High `lightAbsorb`. Pure interaction —
  they eat nearby light proportional to source proximity. NO `shadow_glowing`.
  In darkness: invisible. Near a torch: torch radius shrinks. Correct.

Bridge no longer pushes `gem_glowing` OR `shadow_glowing` for natural gems.
Only voidstone retains the `shadow_glowing` special case (already hardcoded — keep it).

## Option A Confirmed — Two-Pass Within collectLightSources

Code flow (verified line numbers):
```
line 166: collectLightSources(view, opts) starts
line 175: player light pushed first
line 234: entity loop begins
line 343: current gem block (to replace with defer)
line 367: entity loop ends   ← INSERT INTERACTION PASS HERE
line 369: gaze beams
```

During entity loop: gems with `gemOptical` deferred into local `gemInteractors[]`.
Fallback (no `gemOptical`): emit old fixed breathe immediately (backward compat).

After entity loop (line 367), before gaze beams:
1. Snapshot `baseLightCount = out.length` — non-gem lights only
2. For each gem in `gemInteractors`:
   a. Emit base glow (material-parameterised)
   b. Scan `out[0..baseLightCount-1]` for positive nearby sources
   c. Per nearby source: caustic + glint
   d. Once if any nearby source: absorption shadow (if `lightAbsorb > 0.5`)

---

## The Contract (Architecture Rule)

> Material optical props live in `materials.js`.  
> Bridge translates them into display-layer params via `worldView.js`.  
> Display layer **never** imports from rules, **never** duplicates optical data.

Bridge computes derived display params once. Display consumes them.

---

## Optical Property → Display Param Mappings

### Radius (from `lightPass`)

Transmissivity = how far light penetrates and scatters outward.

```
radius = 1.0 + lightPass * 5.5     // range: 1.0 (jet) → 6.5 (diamond)
```

| Gem       | lightPass | radius |
|-----------|-----------|--------|
| Diamond   | 0.92      | 6.1    |
| Beryl     | 0.82      | 5.5    |
| Topaz     | 0.84      | 5.6    |
| Amber     | 0.55      | 4.0    |
| Opal      | 0.70      | 4.9    |
| Fluorite  | 0.78      | 5.3    |
| Garnet    | 0.72      | 5.0    |
| Turquoise | 0.10      | 1.6    |
| Jet       | 0.00      | → shadow |

Glass (lightPass ~0.70) lands near opal — similar radius but different pattern
makes it visually distinguishable from real gems even unidentified.

### Softness/Penumbra (from `lightReflect`)

High reflectivity → hard catchlights, crisp penumbra edge (gems that glitter).
Low reflectivity → soft diffuse glow (gems that absorb and re-emit).

```
softness = Math.round(10 - lightReflect * 40)   // range: 3 (diamond) → 9 (amber/garnet)
softness = Math.max(2, softness)
```

Diamond (0.17) → softness 3 — hard, glittering  
Amber (0.07) → softness 7 — soft, diffuse warm pool  
Jet (0.03) → shadow path, doesn't apply  

### Temporal Pattern (by material class)

The character of how the light moves over time.

| Material      | Pattern   | Rationale |
|---------------|-----------|-----------|
| diamond       | `steady`  | Cold precision — no drift |
| corundum      | `breathe` | Ruby/sapphire: slow deep pulse |
| beryl         | `breathe` | Emerald/aquamarine: organic pulse |
| zircon        | `shimmer` | Jacinth: high dispersion, quick flash |
| topaz         | `candle`  | Warm, slight organic drift |
| chrysoberyl   | `shimmer` | Chatoyancy effect |
| opal          | `biolum`  | Play-of-color: chaotic iridescent shift |
| fluorite      | `biolum`  | Fluorescence: eerie cold blue-green |
| garnet        | `breathe` | Deep slow pulse |
| turquoise     | `steady`  | Matte opaque, no movement |
| amber         | `candle`  | Warm organic (trapped-in-resin feel) |
| glass         | `breathe` | Cheaper version of gem it mimics |
| jet           | → void    | shadow_glowing path |
| obsidian      | → void    | shadow_glowing path |
| voidstone     | → void    | Already handled |

### Color Temperature Tint

Optical color of the material biases the light it casts.  
Not a new field — a tint multiplier on the existing palette color.

```javascript
// Applied in bridge, baked into the RGB passed to emitPatterned
const MATERIAL_LIGHT_TINT = {
  diamond:     [0.95, 0.97, 1.00],  // cold white
  corundum:    [1.00, 0.88, 0.88],  // ruby warm / sapphire overridden by palette
  beryl:       [0.90, 1.00, 0.92],  // green-cool
  topaz:       [1.00, 0.95, 0.80],  // warm yellow
  amber:       [1.00, 0.85, 0.60],  // deep warm orange
  fluorite:    [0.85, 0.95, 1.00],  // cool blue-green
  opal:        [1.00, 1.00, 1.00],  // identity — color shifts from pattern
  chrysoberyl: [0.95, 1.00, 0.85],  // cat's eye green-gold
  garnet:      [1.00, 0.80, 0.80],  // deep red
  turquoise:   [0.85, 1.00, 0.95],  // teal
  quartz:      [1.00, 1.00, 1.00],  // neutral
  glass:       [1.00, 1.00, 1.00],  // neutral — same as quartz, but dimmer
};
```

---

## Shadow Gems (Void Path)

Jet, obsidian → `lightAbsorb >= 0.85` → route to `shadow_glowing`.

These already work for voidstone. The bridge should auto-detect via threshold,
not hardcode each material id.

```javascript
// bridge rule
if (mat.lightAbsorb >= 0.85 || mat.lightPass < 0.05) → shadow_glowing
```

---

## Bridge Schema Change

Add to entity view record for gem items:

```javascript
rec.gemOptical = {
  radius:   <computed>,   // float
  softness: <computed>,   // int
  pattern:  <string>,     // 'breathe' | 'shimmer' | 'candle' | 'biolum' | 'steady'
  tint:     [r, g, b],    // float multipliers, applied to palette color
  isVoid:   <bool>,       // true → shadow_glowing path
};
```

This is the **only** place material science is translated. Display reads
`gemOptical` and passes values directly to `emitPatterned`.

---

## Display Change (lighting/sources/index.js)

Replace:
```javascript
if (tags.includes('gem_glowing')) {
  const col = paletteGlow(kind) || [200, 150, 255];
  emitPatterned(out, 'breathe', t, e.id, ex, ey, 3, col, 6);
}
```

With:
```javascript
if (tags.includes('gem_glowing') && e.gemOptical) {
  const opt = e.gemOptical;
  const base = paletteGlow(kind) || [200, 150, 255];
  const col = [
    Math.round(base[0] * opt.tint[0]),
    Math.round(base[1] * opt.tint[1]),
    Math.round(base[2] * opt.tint[2]),
  ];
  emitPatterned(out, opt.pattern, t, e.id, ex, ey, opt.radius, col, opt.softness);
} else if (tags.includes('gem_glowing')) {
  // fallback for gems without material data
  const col = paletteGlow(kind) || [200, 150, 255];
  emitPatterned(out, 'breathe', t, e.id, ex, ey, 3, col, 6);
}
```

---

## Open Questions / Future Hooks

1. **`shimmer` pattern** — does it exist? May need to add to `emitPatterned` if not.
   Check `display/lighting/sources/index.js` pattern list before implementing.

2. **`steady` pattern** — same check. May just be `breathe` with amplitude=0.

3. **Socketed gems** — gems in weapon sockets should cast light from the weapon's
   position, not just floor drops. Follow-up work, not blocking.

4. **Inventory gems** — floor-only for now. Gems in inventory don't emit light
   (makes sense physically).

5. **`lightEmit > 0`** — all gems currently have `lightEmit: 0.0`. Future:
   radioactive minerals, magical gems post-enchantment, dilithium crystal.
   The system naturally supports this — just set `lightEmit` and the bridge
   scales `radius` accordingly.

6. **Material tint on corundum** — ruby and sapphire share `corundum` material
   but have opposite colors. Tint is applied ON TOP of palette color, so palette
   already handles this correctly. Corundum tint just adds slight warmth.

7. **This is the template** — once gem lighting is landed, same pattern applies:
   - Metal sheen (iron, silver, gold reflect catchlights)
   - Lava/magma (`lightEmit` high, warm color temp)
   - Wet stone (lightReflect spikes when water component present)
   - Bioluminescent ooze (lightEmit + biolum pattern)

---

## Files to Touch

| File | Change |
|------|--------|
| `src/bridge/schema/worldView.js` | Add 2 imports; add `MATERIAL_PATTERN` + `MATERIAL_LIGHT_TINT` constants; replace gem block in `projectItemAffixDisplayTags` |
| `src/display/lighting/sources/index.js` | Add `gemInteractors[]` local; replace lines 343–347 with defer logic; add interaction pass after line 367 |
| `src/rules/data/materials.js` | No changes — `getMaterialIntrinsic` already exported |

No new files. No new systems. No new components.

---

## Exact Code — Bridge (`worldView.js`)

### New imports (add after existing imports)
```javascript
import { getMaterialIntrinsic } from '../../rules/data/materials.js';
import { getGem } from '../../rules/data/gems.js';
```

### New constants (before `projectItemAffixDisplayTags`)
```javascript
const MATERIAL_PATTERN = {
  diamond:     'holy',
  corundum:    'breathe',
  beryl:       'breathe',
  zircon:      'pulse',
  topaz:       'candle',
  chrysoberyl: 'pulse',
  opal:        'biolum',
  fluorite:    'biolum',
  garnet:      'breathe',
  turquoise:   'breathe',
  amber:       'candle',
  quartz:      'breathe',
  glass:       'breathe',
};

const MATERIAL_LIGHT_TINT = {
  diamond:     [0.95, 0.97, 1.00],
  corundum:    [1.00, 0.90, 0.90],
  beryl:       [0.90, 1.00, 0.92],
  zircon:      [1.00, 0.95, 0.85],
  topaz:       [1.00, 0.95, 0.80],
  chrysoberyl: [0.95, 1.00, 0.85],
  opal:        [1.00, 1.00, 1.00],
  fluorite:    [0.85, 0.95, 1.00],
  garnet:      [1.00, 0.80, 0.80],
  turquoise:   [0.85, 1.00, 0.95],
  amber:       [1.00, 0.85, 0.60],
  quartz:      [1.00, 1.00, 1.00],
  glass:       [1.00, 1.00, 1.00],
};
```

### Replace gem block in `projectItemAffixDisplayTags` (lines 576–582)
```javascript
if (itemInfo && String(itemInfo.type || '').toLowerCase() === 'gem') {
  // Voidstone: magical darkness aura — retains shadow_glowing (intrinsic, not physics)
  if (String(kind || '').toLowerCase() === 'gem_voidstone') {
    if (!rec.tags.includes('shadow_glowing')) rec.tags.push('shadow_glowing');
  } else {
    // Natural gems: no emission tag. Attach gemOptical for interaction-only rendering.
    const gemDef = getGem(String(kind || ''));
    const mat = getMaterialIntrinsic(gemDef?.material || 'quartz');
    if (mat) {
      rec.gemOptical = {
        lightPass:    mat.lightPass,
        lightReflect: mat.lightReflect,
        lightAbsorb:  mat.lightAbsorb,
        tint: MATERIAL_LIGHT_TINT[mat.kind] || [1.0, 1.0, 1.0],
      };
    }
  }
}
```

Note: `pattern`, `radius`, `softness` removed from `gemOptical` — those were
emission params. Interaction pass derives everything from the raw optical values directly.

---

## Exact Code — Sources Layer (`lighting/sources/index.js`)

### Add before entity loop (line ~234)
```javascript
const gemInteractors = [];
```

### Replace lines 343–347 — gems no longer emit, just collect
```javascript
// Natural gems: no emission. Deferred to interaction pass.
if (e.gemOptical) {
  gemInteractors.push({ id: e.id, x: ex, y: ey, kind, opt: e.gemOptical });
}
// Old gem_glowing fallback removed — natural gems are interaction-only.
// Magical gems that should glow will have a different tag (future work).
```

### Interaction pass — insert after line 367 (end of entity loop)
```javascript
// ---- Gem light-material interaction pass --------------------------------
// Pure interaction — no base emission. Gems respond to incoming light only.
// baseLightCount snapshot: only scan sources that existed before gem pass,
// so gem responses never trigger other gems (no cross-gem caustic chains).
if (gemInteractors.length > 0) {
  const baseLightCount  = out.length;
  const MAX_CAUSTICS    = 2;
  const CAUSTIC_DIST_SQ = 8 * 8;
  const GLINT_DIST_SQ   = 5 * 5;
  const ABSORB_DIST_SQ  = 5 * 5;

  for (let gi = 0; gi < gemInteractors.length; gi++) {
    const { id, x: gx, y: gy, kind, opt } = gemInteractors[gi];
    let causticCount = 0;
    let didAbsorb    = false;

    for (let si = 0; si < baseLightCount; si++) {
      const src = out[si];
      if (!src || src.color[0] < 0) continue; // skip void sources

      const dx = gx - src.x, dy = gy - src.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < 0.01) continue;

      // Caustic — light passes through gem, pools on far side
      if (opt.lightPass > 0.3 && distSq <= CAUSTIC_DIST_SQ && causticCount < MAX_CAUSTICS) {
        const dist = Math.sqrt(distSq);
        const srcI    = src.flicker != null ? src.flicker : 1.0;
        const strength = opt.lightPass * srcI * Math.max(0, 1 - dist / 8);
        if (strength > 0.08) {
          const ndx = dx / dist, ndy = dy / dist;
          out.push({
            x: gx + ndx * 1.5,
            y: gy + ndy * 1.5,
            radius:   opt.lightPass * 2.5 * strength,
            color:    [
              Math.round(Math.max(0, Math.min(255, src.color[0] * opt.tint[0]))),
              Math.round(Math.max(0, Math.min(255, src.color[1] * opt.tint[1]))),
              Math.round(Math.max(0, Math.min(255, src.color[2] * opt.tint[2]))),
            ],
            softness: 2,
            flicker:  strength,
          });
          causticCount++;
        }
      }

      // Specular glint — hard bright point at gem position
      if (opt.lightReflect > 0.08 && distSq <= GLINT_DIST_SQ) {
        const srcI    = src.flicker != null ? src.flicker : 1.0;
        const gStr    = opt.lightReflect * srcI * Math.max(0, 1 - Math.sqrt(distSq) / 5);
        if (gStr > 0.015) {
          out.push({
            x: gx, y: gy,
            radius:   opt.lightReflect * 1.8,
            color:    [255, 252, 245],
            softness: 1,
            flicker:  gStr,
          });
        }
      }

      // Absorption shadow — high-absorb gems eat nearby light (once per gem)
      if (!didAbsorb && opt.lightAbsorb > 0.5 && distSq <= ABSORB_DIST_SQ) {
        emitVoid(out, t, id, gx, gy, opt.lightAbsorb * 1.5, (opt.lightAbsorb - 0.5) * 0.6, 8);
        didAbsorb = true;
      }
    }
  }
}
```
