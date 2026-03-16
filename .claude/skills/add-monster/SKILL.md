---
name: add-monster
description: Add a new monster to the roguelike dungeon crawler
argument-hint: <monster_id>
disable-model-invocation: true
---

Add a new monster to `src/rules/data/monsters.js` with id `$ARGUMENTS`.

## Steps

1. **Ask the user** for the monster's concept if not obvious from the name — theme, tier, special abilities, flavor.
2. **Read `src/rules/data/monsters.js`** to see current monsters and available callback imports.
3. **Design the monster** following the schema and balance guidelines below.
4. **Add the entry** to the `MONSTERS` array, placed within the correct tier comment block (Tier 0 / 1 / 2 / 3 / 99).
5. **Add any new callback imports** at the top of the file if needed.
6. **Add a palette entry** in `src/display/palette/base.js` (see Palette section below).
7. **Run tests**: `deno test --allow-read` to verify nothing broke.

## Required Fields (MonsterDef)

Every monster object MUST have all of these fields:

```
id            string     — snake_case unique identifier
name          string     — display name
tags          string[]   — e.g. ['undead','skeletal'], ['beast','venomous'], ['humanoid']
tier          number     — 0 (floors 1-5), 1 (floors 6-10), 2 (floors 11-15), 3 (floors 16+), 99 (special/untiered)
intelligence  number     — 1-10 (drives AI behavior, see tiers below)
baseHp        number     — starting HP
hpPerLevel    number     — HP gained per dungeon depth
attack        number     — attack bonus
defense       number     — defense bonus
damageDice    string     — e.g. '1d4', '2d6', '3d8'
sizeClass     string     — 'XS', 'S', 'M', 'L', 'XL'
massKg        number     — weight in kilograms
resistances   object     — at minimum { kinetic: { DR: N } }; can add bluntMult, pierceMult, slashMult, chemical.toxMult, thermal.burnMult, electric.ohms
speed         number     — 1 (slow) to 3 (fast); actEvery = max(1, 4-speed)
hooks         object|null — combat/AI callback hooks, or null if none
specials      string[]   — human-readable list of special abilities (shown in UI)
description   string     — flavor text
```

## Optional Fields

```
aggro           'passive'   — won't attack on sight (only when struck)
packSense       true        — alerts nearby same-species on sighting
packRadius      number      — radius for pack alerting
retreatHpPct    number      — flee threshold (0.0-1.0), e.g. 0.25 = flee at 25% HP
ambush          true        — holds position until player within Chebyshev dist 1
canFly          true        — can fly over terrain
rare            true        — excluded from normal tier spawn pool
visionRange     number      — override default vision (used by casters/ranged)
lootTable       string      — e.g. 'drop:goblin', 'drop:tier2'; defaults to 'drop:tier{tier}'
equipment       object      — { ranged: 'bow_short', ammo: 'arrows' } for ranged mobs
learnedSpellIds string[]    — spell IDs the monster can cast
maxMana         number      — mana pool (required if learnedSpellIds set)
manaRegen       number      — mana regen per turn (required if learnedSpellIds set)
```

## Intelligence Tiers (AI behavior)

- **1-3 (dumb)**: scurry system — wanders randomly when unaware (50% rest chance)
- **4-5 (dim)**: basic chase, pack behavior
- **6-7 (cunning)**: tactical — retreat, ambush capable
- **8-9 (smart)**: predator — retreat + advanced positioning
- **10 (sapient)**: picks up floor weapons if humanoid tag + unarmed

## Available Callback Imports

From `./callbacks/combat.js`:
- `statusEffectOnHit(chance%, salt, { key, turnsLeft, potency }, procEvent)` — apply status on hit
- `selfBuffOnHit({ key, turnsLeft, potency })` — self-buff when hitting
- `drainOnHit(chance%, salt, amount)` — drain HP on hit
- `bonusDamageOnBeforeHit(chance%, salt, amount, procEvent)` — bonus damage before hit
- `bonusDamageIfTargetAfflicted(amount, statusKeys[], procEvent)` — bonus vs afflicted
- `healOnDamaged(chance%, salt, amount, procEvent)` — self-heal when taking damage
- `retaliateOnDamaged(amount, procEvent)` — reflect damage
- `statusEffectOnDamaged(chance%, salt, { key, turnsLeft, potency }, procEvent, isSelf)` — status on taking damage
- `phaseOutOnDamaged(chance%, salt)` — dodge/phase out when hit
- `mindflayerBlastOnHit(chance%, salt)` — psychic blast on hit

From `./callbacks/ai.js`:
- `selfThrowNearTargetOnSeen({ searchRadius, fallbackSearchRadius, cooldownTurns, chance })` — web throw on sight
- `gazeOnLOS(minRange, maxRange, actEvery)` — gaze stun mechanic
- `fireBreathLineOnLOS({ minRange, maxRange, cooldownTurns, damage, hazardDamage, hazardTurns, burnTurns, burnPotency })` — fire breath
- `castSpellOnLOS({ spellId, minRange?, maxRange?, cooldownTurns, chance, targeting?, maxAlliesInRadius?, allyRadius? })` — cast spell in LOS

From `./callbacks/death.js`:
- `spawnPlasmaCloudOnDeath({ turnsLeft, radius, damage })` — AoE on death

## Hook Slots

```
onHit       — fires when this monster hits a target
onBeforeHit — fires before damage is applied
onDamaged   — fires when this monster takes damage
onSeen      — fires when player first enters LOS
whileLOS    — fires every turn while player is in LOS (for gaze, breath, spells)
onDeath     — fires when this monster dies
```

## Salt Convention

Each `statusEffectOnHit` / similar callback needs a unique hex salt for deterministic RNG. Use the pattern `0xdead####` where `####` is an unused hex value. Check existing monsters for used salts and pick a new one.

## Balance Guidelines by Tier

| Tier | baseHp | attack | defense | DR  | damageDice |
|------|--------|--------|---------|-----|------------|
| 0    | 3-28   | 0-4    | 0-3     | 0-10| 1d2-2d6    |
| 1    | 8-15   | 1-3    | 0-2     | 2-6 | 1d4-1d8    |
| 2    | 13-30  | 3-5    | 1-4     | 4-14| 1d6-2d8    |
| 3    | 28-50  | 4-6    | 4-6     | 6-18| 2d6-3d8    |

## Palette Entry (`src/display/palette/base.js`)

Every monster needs a palette entry so it renders on screen. Add to the correct tier section.

```js
my_monster: { glyph: "M", fg: "#ff4444", glow: "#cc0000" },
```

### Fields
- `glyph` — single ASCII character (or emoji for special cases)
- `fg` — foreground hex color (what the player sees)
- `glow` — glow/shadow hex color (slightly darker/muted version of fg)

### Glyph Conventions
| Type          | Glyph | Examples                               |
|---------------|-------|----------------------------------------|
| Humanoid S    | lowercase | g=goblin, k=kobold, o=orc          |
| Humanoid L    | UPPERCASE | O=ogre, T=troll, L=lich            |
| Beast small   | lowercase | r=rat, b=bat, x=spider/bug         |
| Beast large   | UPPERCASE | D=dragon, S=snake                  |
| Skeletal      | s     | skeleton, skeleton_archer, bone_bowman |
| Spectral      | W     | wraith                                 |
| Demon         | &     | demon                                  |
| Aberration    | e     | floating_eye                           |
| Mimic         | M     | mimic                                  |
| Construct     | #     | stone_taunter                          |

### Color Families
| Theme     | fg example  | glow example |
|-----------|-------------|--------------|
| Bone/undead | #ddd8c8   | #aaa590      |
| Green/orc | #cc6644     | #993320      |
| Purple/magic | #cc88ff  | #9955cc      |
| Fire/red  | #ff4444     | #cc0000      |
| Ice/blue  | #aabbff     | #7799dd      |
| Electric/yellow | #ffff66 | #cccc33    |
| Poison/green | #55bb55  | #338833      |

Corpses are auto-generated by `buildPalette()` — all monsters inherit their fg/glow with a `%` glyph.

## Rules

- JavaScript only — no TypeScript.
- Use `world.rand()` for RNG, never `Math.random()`.
- Place the entry in the correct tier section of the MONSTERS array.
- If adding a new callback type, import it at the top of the file.
- Always add a matching palette entry in `src/display/palette/base.js`.
- Run `deno test --allow-read` after adding the monster.
