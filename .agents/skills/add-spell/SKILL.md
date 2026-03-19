---
name: add-spell
description: Add a new spell to the roguelike dungeon crawler
argument-hint: <spell_id>
disable-model-invocation: true
---

Add a new spell with id `$ARGUMENTS` to the game.

Every spell requires changes across **4-6 files**. ALL steps are mandatory unless marked optional.

## Steps

1. **Ask the user** for the spell concept: damage type, targeting, status effects, flavor.
2. **Read the reference files** listed below to understand existing patterns.
3. **Define the spell** in `src/rules/data/spells.js` (SPELL_DEFS object).
4. **Write the script** in `src/rules/scripts/spells.js` (REGISTRY).
5. **Add VFX** — at least one of: projectile in `projectileFx.js`, area FX in `spellAreaFx.js`, bolt FX in `boltFxController.js`. **Never skip VFX.** Smite is a cautionary example: it shipped without VFX and feels lifeless.
6. **Add a spellbook** to `src/rules/data/itemCatalog.js` so players can learn it.
7. **Add spellbook to palette** in `src/display/palette/base.js` (glyph + colors).
8. **Add spellbook to loot table** in `src/rules/data/lootTables.js` (sub:spellbooks).
9. **Add message wiring** in `src/display/ui/wiring/messageWiring.js` for failure/fizzle/special messages.
10. **Run tests**: `deno test --allow-read`.

---

## File 1: Spell Definition (`src/rules/data/spells.js`)

Add an entry to the `SPELL_DEFS` object. Every field is documented in the JSDoc typedef at the top.

### Required Fields
```
id              string    — snake_case unique key
name            string    — display name
symbol          string    — Unicode glyph for UI (e.g. '\u2744' = ❄, '\u26A1' = ⚡)
manaCost        number    — base mana cost (or use manaPerTick for channels)
minIntelligence number    — min INT to learn (0 = any class)
script          string    — key matching REGISTRY in spells.js
targeting        string   — 'auto'|'target'|'self'|'area'|'path'|'enemy'
description     string    — flavor text for tooltip
effects         array     — human-readable effect descriptions (for UI)
```

### Optional Fields
```
schools          string[] — ['destruction'], ['healing'], ['holy','destruction'], ['trickery']
range            number   — max casting range in tiles
radius           number   — AoE radius
castTime         number   — turns to channel before casting (0/omitted = instant)
channeling       boolean  — true = sustained realtime channel
manaPerTick      number   — mana drained per channel tick (replaces manaCost for channels)
boltsPerTick     number   — storm impacts per sustain tick
maxTargets       number   — max chain/bounce targets
clearMindedCasting boolean — true = ignores confused/hallucinating misdirection
```

### Targeting Modes
- `auto` — nearest hostile in LOS (frost, lightning, shadow_bolt)
- `target` — player picks a tile (meteor, smite, heal)
- `self` — centered on caster (blastwave, flash_heal)
- `area` — player picks center for AoE (blizzard, firestorm)
- `path` — teleport along a line (phase_strike)
- `enemy` — player picks a visible hostile (agony)

### Effects Array
Each entry describes one aspect of the spell for the UI tooltip:
```js
{ kind: 'damage', element: 'fire', amount: '8 base, INT-scaled, can crit' }
{ kind: 'status', status: 'frost', duration: '3-5 turns' }
{ kind: 'movement', mode: 'knockback', note: 'Pushes targets away' }
{ kind: 'utility', note: 'Chains to 3 targets' }
```

### Reference Examples (read these)
- **frost** — single-target auto projectile + status
- **shadow_bolt** — single-target auto projectile, pure damage, castTime
- **agony** — enemy-targeted DOT curse with INT scaling
- **meteor** — targeted AoE with burn DOT + hazard spawning
- **blizzard/firestorm** — sustained channel storm via `runStormScript`

---

## File 2: Spell Script (`src/rules/scripts/spells.js`)

Register handler: `REGISTRY['spell_id'] = function spellIdScript(world, actor, spell, intent) { ... }`.

### Faction-Aware Targeting (CRITICAL)

Spells can be cast by both the player AND monsters (via `castSpellOnLOS`). **Never hardcode faction checks.** Always use `areFactionsHostile`:

```js
// CORRECT — works for player AND monster casters:
const actorFaction = String(world.get(actor, Faction)?.key || 'player');
if (!fac || !areFactionsHostile(actorFaction, fac.key)) continue;

// WRONG — only works for player casters:
if (!fac || fac.key !== 'enemy') continue;
```

Reference: `shadow_bolt` does this correctly. `lightning` shipped with the hardcoded check and was silently broken for all monster casters.

### Standard Script Pattern

```js
REGISTRY['my_spell'] = function mySpellScript(world, actor, spell, intent) {
  // 1. Get caster position
  const apos = /** @type any */ (world.get(actor, Position));
  if (!apos) return;
  const actorFaction = String(world.get(actor, Faction)?.key || 'player');

  // 2. Build LOS blocker
  const isBlocked = createLOSBlocker(world);

  // 3. Find target (auto-target nearest hostile in LOS)
  const MAX_R = Math.max(1, Number(spell.range || 8));
  // ... candidate collection using areFactionsHostile, LOS check, pick nearest ...

  // 4. If no target, emit fizzle event and return
  if (!target) {
    world.emit('spell:my_spell', { actor, fizzle: true });
    return;
  }

  // 5. Calculate projectile delay (for projectile spells)
  const dist = Math.hypot(target.x - apos.x, target.y - apos.y) || 1;
  const delay = Math.max(0.1, Math.min(0.6, dist / PROJECTILE_SPEED));

  // 6. Apply damage via dealDamage + buildSpellDamageSpec
  const result = dealDamage(world, buildSpellDamageSpec(world, actor, target.id, {
    spell,
    baseAmount: BASE_DMG,
    type: 'fire',         // damage element
    cause: 'spell:my_spell',
    at: { x: target.x, y: target.y },
    projectileDelay: delay,  // syncs float text with projectile arrival
    salt: target.id,
  }));

  // 7. Apply status effects (if spell has them)
  if (result.applied && !result.killed) {
    let ae = /** @type any */ (world.get(target.id, ActiveEffects));
    if (!ae) {
      try { world.add(target.id, ActiveEffects, { effects: [] }); } catch {}
      ae = /** @type any */ (world.get(target.id, ActiveEffects));
    }
    if (ae && Array.isArray(ae.effects)) {
      upsertTimedEffect(ae.effects, {
        key: 'frost', turnsLeft: 3, potency: 1, stacks: 1,
        startedAtTurn: world.step, sourceId: actor,
      });
    }
  }

  // 8. Emit semantic VFX event (display layer listens)
  world.emit('spell:my_spell', {
    actor,
    targetId: target.id,
    from: { x: apos.x, y: apos.y },
    at: { x: target.x, y: target.y },
    // ...any extra data the VFX needs
  });
};
```

### Damage Types
`'fire' | 'cold' | 'electric' | 'physical' | 'holy' | 'shadow' | 'poison' | 'acid' | 'radiation'`

Each maps to a specific resistance field in the target's Resistances component.

### Key Imports Available in spells.js
Already imported at the top — use freely:
- `Position, Faction, Vitality, Brain, Collider, ActiveEffects, Physiology, DungeonState`
- `isWalkable`, `buildBlocksVisionMap`, `blockedCallback`, `hasLOS`, `bresenhamLine`
- `dealDamage`, `buildSpellDamageSpec`, `createSpellDamageContext`, `scaleSpellDamage`
- `getSpellIntelligenceBonus`, `rollSpellHit`, `emitSpellMiss`, `getSpellHitChancePct`
- `hasSpellLineOfSight`, `findNearestValidTileAround`
- `combatSeed`, `mulberry32` (deterministic RNG)
- `upsertTimedEffect`, `statusStrength`
- `areFactionsHostile`, `getPassiveBonuses`
- `spawnHazard` (for fire/ice/poison ground effects)
- `createFrom`, `Monster` (for summon spells)

### Helper Functions Already Available
- `chebyshev(a, b)` — Chebyshev distance
- `createLOSBlocker(world)` — returns `(x,y) => boolean` for LOS checks
- `resolveSpellRadius(world, actor, spell)` — base radius + passive bonuses
- `resolveStormCenter(world, actor, spell, intent)` — validates storm AoE center
- `runStormScript(world, actor, spell, intent, tuning)` — shared storm implementation
- `createSpellDotEffect(world, actor, spell, opts)` — snapshot DOT with spell damage context
- `hashString32(value)` — FNV-1a hash for deterministic salts

### Hit/Miss System
For spells that can miss (enemy-targeted, not auto):
```js
const hitChancePct = getSpellHitChancePct(world, actor, targetId);
if (!rollSpellHit(world, actor, targetId, spell)) {
  emitSpellMiss(world, actor, targetId, spell, {
    cause: 'spell:my_spell', hitChancePct, at: { x, y },
  });
  world.emit('spell:my_spell', { actor, targetId, missed: true });
  return;
}
```

### DOT Spells (like Agony)
Use `createSpellDotEffect` to snapshot caster stats at cast time:
```js
const effect = createSpellDotEffect(world, actor, spell, {
  key: 'agony', turnsLeft: 8, potency: 2, stacks: 1,
  cause: 'spell:agony', type: 'shadow',
});
upsertTimedEffect(ae.effects, effect);
```

---

## File 3: VFX (MANDATORY — never skip this)

Every spell needs visual feedback. Choose one or more VFX approaches:

### Option A: Projectile (`src/display/fx/projectileFx.js`)
For single-target bolt/projectile spells (frost, shadow_bolt).

1. **Add state arrays** at top of `createProjectileFxController`:
```js
const _myspellFx = [];
const _myspellImpact = [];
```

2. **Add tick logic** — trail particles during flight + impact burst on arrival:
```js
// In tick(dt):
for (let i = _myspellFx.length - 1; i >= 0; i--) {
  const p = _myspellFx[i];
  // Spawn trailing particles during flight
  if (fx?.pool && p.progress < 1) {
    const hx = p.from.x + (p.to.x - p.from.x) * p.progress;
    const hy = p.from.y + (p.to.y - p.from.y) * p.progress;
    // spawn Particle({ x, y, vx, vy, life, size0, size1, r, g, b, a0 })
  }
  p.tick(dt);
  if (p.arrived) {
    _myspellImpact.push(new RadialFx({ x: p.to.x, y: p.to.y, radius: 0.7, ttl: 0.40 }));
    startShake(cam, 3, 0.14);
    // spawn impact burst particles
    _myspellFx.splice(i, 1);
  }
}
```

3. **Add draw logic** — projectile rendering (trail + head glow + core):
```js
// In draw(ctx):
if (_myspellFx.length) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of _myspellFx) {
    // Outer glow trail, inner bright trail, head glow layers
  }
  ctx.restore();
}
// Impact expanding ring
if (_myspellImpact.length) { ... }
```

4. **Route the style** in `spawnTransientProjectile`:
```js
if (style === 'my_spell') { _myspellFx.push(entry); return; }
```

5. **Add the `has` check** in draw gate:
```js
const hasMySpell = _myspellFx.length || _myspellImpact.length;
if (!hasArrows && !hasSbolt && ... && !hasMySpell) return;
```

6. **Install event listener**:
```js
world.on('spell:my_spell', ({ from, at, fizzle }) => {
  if (fizzle) return;
  spawnTransientProjectile({ from, to: at, style: 'my_spell', speed: 8 });
});
```

### Option B: Area FX (`src/display/fx/spellAreaFx.js`)
For AoE/radial spells (meteor, blastwave, flash_heal).

Add a `world.on('spell:my_spell', ...)` handler that:
- Pushes `RadialFx` entries for expanding rings
- Spawns `Particle` bursts for visual impact
- Calls `startShake(cam, power, duration)` for screen shake
- Optionally emits `projectile:spawn` for falling projectiles (meteor style)

### Option C: Bolt FX (`src/display/fx/boltFxController.js`)
For chain lightning style — jittered lines between points.

### VFX Color Palettes by Element
| Element  | Primary RGB range           | Glow/accent            |
|----------|-----------------------------|------------------------|
| fire     | (255, 60-170, 10-40)        | orange-white core      |
| cold     | (140-200, 210-250, 255)     | white-blue core        |
| electric | (95-170, 165-220, 255)      | white-cyan core        |
| shadow   | (130-170, 30-80, 200-255)   | dim purple disc        |
| holy     | (255, 240-255, 180-230)     | gold-white             |
| poison   | (80-140, 200-255, 40-80)    | sickly green           |
| acid     | (180-220, 255, 40-80)       | bright yellow-green    |
| physical | (200-240, 200-240, 200-240) | white flash            |

### Screen Shake Guidelines
| Spell power    | Shake power | Duration |
|----------------|-------------|----------|
| Light hit      | 2-3         | 0.08-0.12s |
| Medium hit     | 3-5         | 0.14-0.20s |
| Heavy hit      | 5-7         | 0.18-0.30s |
| Massive AoE    | 7-14        | 0.30-0.55s |

---

## File 4: Spellbook Item (`src/rules/data/itemCatalog.js`)

Add a `book_{spell_id}` entry. The identity prefix `book_` is how the learn hook resolves the spell.

```js
book_my_spell: {
  id: "book_my_spell",
  catalogKind: "magic",
  name: "Spellbook of My Spell",
  type: "learn",
  slot: "bag",
  material: "paper",
  rarity: 1,
  rarityName: "rare",
  description: "Grants the ability to cast My Spell.",
  hooks: {
    on_use: createLearnSpellFromIdentityHook({
      identityPrefix: "book_",
      consumeOnSuccess: true,
    }),
  },
},
```

The hook `createLearnSpellFromIdentityHook` strips `book_` from the id to get the spell id, looks it up in SPELL_DEFS, and adds it to the player's `Brain.learnedSpellIds`.

---

## File 5: Palette Entry (`src/display/palette/base.js`)

Add identity → glyph mapping so the spellbook renders on the ground:

```js
book_my_spell: { glyph: "📕", fg: "#ff704d", glow: "#ff704d" },
```

### Spellbook Glyph Convention by School
| School       | Glyph | Color family         |
|--------------|-------|----------------------|
| fire/destruction | 📕 | red/orange (#ff704d) |
| ice/cold     | 📘    | blue (#4da6ff)       |
| electric     | 📓    | yellow (#ffff66)     |
| shadow/dark  | 📙    | purple (#b366ff)     |
| healing      | 📒    | green (#66ff99)      |
| summoning    | 📓    | pink (#ff66ff)       |
| holy         | 📒    | gold (#ffd966)       |
| trickery     | 📓    | cyan (#66ffcc)       |

---

## File 6: Loot Table (`src/rules/data/lootTables.js`)

Add to the `sub:spellbooks` entries array:

```js
{ type: "item", weight: 25, itemId: "book_my_spell" },
```

Weight determines relative drop chance. Existing weights range 18-35.

---

## File 7: Message Wiring (`src/display/ui/wiring/messageWiring.js`)

Add failure/fizzle/special messages if the spell can fail in interesting ways:

```js
world.on('spell:my_spell:failed', ({ actor, reason, range }) => {
  if (nameOfEntity(actor) !== 'You') return;
  if (reason === 'no_target') {
    log('No target in range.', 'system');
  } else if (reason === 'out_of_range') {
    log(`Target out of range (max ${range}).`, 'system');
  }
});
```

---

## Damage & Resistance Interaction

### How `dealDamage` resolves resistance
```
type: 'fire'     → multiplied by target's thermal.burnMult (default 1.0)
type: 'cold'     → (no standard resist field; immunity via burnMult=0)
type: 'electric' → scaled by BASE_ELECTRIC_OHMS / target's electric.ohms
type: 'physical' → reduced by kinetic.DR flat, then subtype mults
type: 'holy'     → no standard resistance (bypasses most defenses)
type: 'shadow'   → no standard resistance (bypasses most defenses)
type: 'poison'   → multiplied by chemical.toxMult (0 = immune)
type: 'acid'     → multiplied by chemical.acidMult
```

### projectileDelay
For projectile spells, pass `projectileDelay` in the damage spec so float text appears when the projectile arrives, not when damage is calculated:
```js
const dist = Math.hypot(target.x - apos.x, target.y - apos.y) || 1;
const delay = Math.max(0.1, Math.min(0.6, dist / PROJECTILE_SPEED));
// pass to buildSpellDamageSpec options: { projectileDelay: delay }
```
Match the speed to what you use in the VFX listener's `spawnTransientProjectile` call.

---

## Rules

- JavaScript only — no TypeScript.
- Use deterministic RNG: `combatSeed(world.seed, world.step, actor, ...)` + `mulberry32()`. Never `Math.random()` in rules code. (VFX/display code may use `Math.random()`.)
- Emit events with `try { world.emit(...) } catch (e) { console.debug(...) }` pattern.
- All damage flows through `dealDamage(world, buildSpellDamageSpec(...))` — never modify HP directly.
- Status effects go through `ActiveEffects` component + `upsertTimedEffect`.
- Run `deno test --allow-read` after all changes.
