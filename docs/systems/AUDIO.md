# JSHack Audio Engine — Technical Brief

## Overview

File-based audio engine using the Web Audio API. All sounds are real `.wav`/`.mp3`/`.mp4` files loaded from `assets/audio/`. No synthesis. Decoded buffers are cached in memory so every file is fetched and decoded only once.

If a sound file is missing, the engine logs a console warning and plays silence. The game never breaks.

---

## Signal Chain

```
BufferSource → per-sound GainNode → StereoPanner → category Bus GainNode → Master GainNode → speakers
```

Every sound goes through up to 4 nodes before hitting the speakers. Each stage is independently controllable.

---

## File Format Guidelines

| Property | Recommendation |
|---|---|
| Format | 16-bit or 24-bit WAV preferred. MP3 acceptable for longer ambient loops. |
| Sample rate | 44.1kHz or 48kHz |
| Length | One-shots: 0.1s–1.5s. Loops: 3–10s, seamless. |
| Normalization | -3dB peak. Engine handles all relative mixing. |
| Leading silence | Trim to zero. Even 50ms adds noticeable combat latency. |

All files go in `assets/audio/`. Register each file in `src/display/audio/sounds.js`.

---

## Category Buses

5 independent mix groups, each with its own volume knob:

| Bus | Default Volume | Routed Sounds |
|---|---|---|
| `combat` | 1.0 | Melee hits, crits, misses, ranged shots, enemy death, player death |
| `spells` | 1.0 | All 33 spell casts, spell fizzle, 7 element-typed spell impacts |
| `items` | 0.8 | All pickups (8 types), drops (4 types), equips (3 types), chest open |
| `ambient` | 0.6 | Stairs, doors, fountain, rain loop, thunder |
| `ui` | 1.0 | Level up / spell learned |

Adjustable at runtime: `setBusVolume("combat", 0.5)`. Master volume sits on top and scales everything.

---

## Spatial Audio

Every sound with a known world position gets spatialized relative to the player.

### Stereo Panning
- Horizontal offset between source and player.
- ~8 tiles = full left or right pan.
- A monster dying 4 tiles to your right plays from the right speaker at ~50% pan.

### Distance Attenuation
- Full volume at distance ≤1 tile.
- Smooth falloff to 15% volume at 16 tiles.
- Beyond 16 tiles: sound is not played at all.

### Center Sounds (no spatialization)
- Player actions: equipping, stair traverse, level up, player death.
- These always play at full volume, centered.

---

## Polyphony (Voice Limiting)

Each sound has a max concurrent voices cap. When exceeded, the oldest playing instance is cut to make room.

| Sound | Max Voices | Reason |
|---|---|---|
| Most sounds | 3 | Default — prevents stacking distortion |
| Spell impacts | 4 | Blizzard/firestorm can hit multiple targets per cast |
| Thunder | 2 | Multiple lightning strikes possible in sequence |
| Player death | 1 | Only one can happen |
| Level up | 1 | Only one at a time |

---

## Looping Sounds

`rain_loop.wav` is the only looping sound currently. The engine supports:

- **Fade in**: Rain fades in over 2 seconds when weather changes to rain.
- **Fade out**: 3 seconds when weather clears; 1 second on floor transition (going underground).
- **Volume scaling**: Light rain = 0.4, heavy rain = 0.7.
- **Auto-stop**: Rain stops when the player descends into the dungeon.

Future looping sounds (dungeon ambience, fire crackling, wind) use the same `startLoop`/`stopLoop` API.

---

## Two-Moment Spell Audio (Cast vs Impact)

Spells have two distinct sound moments:

1. **Cast sound** — plays on the spell event (e.g. `spell:fireball`) when the spell launches. Spatialized to caster position.
2. **Impact sound** — plays on the `damaged` event when the spell connects after travel. Spatialized to target position. Routed by damage type.

Example: fireball crosses the screen — `spell_fireball.wav` plays from the caster on launch, then `impact_fire.wav` plays from the target on hit.

### Impact Sound Routing

| Damage Type | Impact Sound |
|---|---|
| fire | `impact_fire.wav` |
| ice, cold | `impact_ice.wav` |
| electric, lightning | `impact_lightning.wav` |
| shadow, necrotic | `impact_shadow.wav` |
| holy, radiant | `impact_holy.wav` |
| poison, acid | `impact_poison.wav` |
| (anything else) | `impact_physical.wav` |

---

## Item Sounds by Type

The engine looks up `ItemInfo.type` on the item entity and routes to a category-specific sound:

### Pickup

| Item Type | File |
|---|---|
| weapon | `pickup_weapon.wav` |
| armor / shield / helmet / boots / gloves | `pickup_armor.wav` |
| potion | `pickup_potion.wav` |
| scroll | `pickup_scroll.wav` |
| gold / coin | `pickup_gold.wav` |
| food / corpse | `pickup_food.wav` |
| gem | `pickup_gem.wav` |
| anything else | `pickup_generic.wav` |

### Drop

| Item Type | File |
|---|---|
| weapon | `drop_weapon.wav` |
| armor | `drop_armor.wav` |
| potion | `drop_potion.wav` |
| anything else | `drop_generic.wav` |

### Equip

| Item Type | File |
|---|---|
| weapon | `equip_weapon.wav` |
| armor | `equip_armor.wav` |
| anything else | `equip_generic.wav` |

---

## Per-Sound Playback Overrides

Each sound entry in the registry can define defaults, and each play call can override:

| Parameter | What it does |
|---|---|
| `volume` | 0–1, per-sound gain (multiplied with bus and master) |
| `rate` | Playback speed (1.0 = normal, 0.5 = half, 2.0 = double) |
| `detune` | Pitch shift in cents (100 = one semitone up) |
| `delay` | Seconds before playback starts |
| `bus` | Route to a specific category bus |
| `maxVoices` | Override polyphony cap for this sound |
| `pan` | Force stereo position -1 (left) to +1 (right) |

---

## Complete Sound File List (70 files)

### Combat (6)

| # | Filename | Description |
|---|---|---|
| 1 | `melee_hit.wav` | Standard melee weapon connects with a target |
| 2 | `melee_crit.wav` | Critical melee hit — heavier, more brutal version of melee_hit |
| 3 | `melee_miss.wav` | Melee swing whiffs — air whoosh, no contact |
| 4 | `ranged_shot.wav` | Arrow or projectile fired from a bow/crossbow |
| 5 | `death.wav` | Monster dies — generic creature death thud/collapse |
| 6 | `player_death.wav` | Player character dies — dramatic, final |

### Item Pickup (8)

| # | Filename | Description |
|---|---|---|
| 7 | `pickup_weapon.wav` | Sword/axe/dagger lifted off the ground — metallic scrape |
| 8 | `pickup_armor.wav` | Heavy armor/shield/helmet picked up — clank, weight |
| 9 | `pickup_potion.wav` | Glass vial picked up — liquid slosh, clink |
| 10 | `pickup_scroll.wav` | Parchment scroll picked up — paper rustle |
| 11 | `pickup_gold.wav` | Coins scooped up — jingle, metallic rattle |
| 12 | `pickup_food.wav` | Bread/meat/rations grabbed — soft thump |
| 13 | `pickup_gem.wav` | Gemstone picked up — small crystalline chime |
| 14 | `pickup_generic.wav` | Catch-all — generic small object lifted |

### Item Drop (4)

| # | Filename | Description |
|---|---|---|
| 15 | `drop_weapon.wav` | Weapon dropped on stone floor — metallic clatter |
| 16 | `drop_armor.wav` | Heavy armor dropped — loud heavy metal impact on stone |
| 17 | `drop_potion.wav` | Glass vial set down or tossed — glass clink on stone |
| 18 | `drop_generic.wav` | Generic item dropped — light thud on stone |

### Item Equip (3)

| # | Filename | Description |
|---|---|---|
| 19 | `equip_weapon.wav` | Weapon drawn/readied — unsheathe, grip tighten |
| 20 | `equip_armor.wav` | Armor strapped on — buckle, heavy cloth/metal layering |
| 21 | `equip_generic.wav` | Generic item equipped — small click/snap |

### Environment (5)

| # | Filename | Description |
|---|---|---|
| 22 | `chest_open.wav` | Wooden chest lid creaks open — hinge creak, wood thump |
| 23 | `stair_descend.wav` | Descending stone stairs deeper into dungeon — echoing footsteps going down |
| 24 | `stair_ascend.wav` | Ascending stone stairs toward surface — echoing footsteps going up |
| 25 | `door_open.wav` | Heavy wooden dungeon door swings open — creak, thud |
| 26 | `fountain.wav` | Stone fountain bubbling/trickling water |

### Spell Cast (33)

| # | Filename | Description |
|---|---|---|
| 27 | `spell_bolt.wav` | Generic energy bolt launched — electric crackle, short zap |
| 28 | `spell_frost.wav` | Ice shard projectile launched — crystalline crack, cold whoosh |
| 29 | `spell_shadow_bolt.wav` | Dark energy bolt launched — deep, ominous hum with whisper |
| 30 | `spell_fireball.wav` | Fireball launched — ignition whomp, crackling flame trail |
| 31 | `spell_meteor.wav` | Meteor summoned from above — deep rumble, descending roar |
| 32 | `spell_blizzard.wav` | Blizzard conjured — howling wind, ice shards swirling |
| 33 | `spell_firestorm.wav` | Firestorm erupts — roaring flames, multiple ignitions |
| 34 | `spell_blastwave.wav` | Shockwave expands outward — concussive boom, air displacement |
| 35 | `spell_heal.wav` | Healing magic applied — warm chime, gentle shimmer |
| 36 | `spell_smite.wav` | Holy bolt strikes from above — bright crack, radiant impact |
| 37 | `spell_death_volley.wav` | Volley of necrotic bolts — rapid dark pulsing, bone rattle |
| 38 | `spell_blink.wav` | Short-range teleport — spatial tear, pop in/pop out |
| 39 | `spell_plague_swarm.wav` | Swarm of insects/disease launched — buzzing, chittering |
| 40 | `spell_earthshatter.wav` | Ground cracks and erupts — heavy stone fracture, rumble |
| 41 | `spell_war_cry.wav` | Warrior battle shout — raw aggressive voice, reverb |
| 42 | `spell_cleave.wav` | Wide sweeping blade arc — heavy whoosh, steel sing |
| 43 | `spell_rampage.wav` | Frenzied multi-hit attack — rapid successive impacts |
| 44 | `spell_phase_strike.wav` | Teleport-slash — spatial rip followed by blade contact |
| 45 | `spell_shield_bash.wav` | Shield slammed into target — heavy metal thud, stun ring |
| 46 | `spell_wolf_howl.wav` | Wolf companion howls — wolf howl, primal, echoing |
| 47 | `spell_boar_charge.wav` | Boar companion charges — hooves pounding, snort, impact |
| 48 | `spell_consecrate.wav` | Holy ground sanctified — rising choral tone, radiant hum |
| 49 | `spell_divine_shield.wav` | Holy barrier surrounds caster — bright bell, shimmering dome |
| 50 | `spell_purify.wav` | Cleanse debuffs — clean chime, dissolving hiss |
| 51 | `spell_bloodthirst.wav` | Life-steal buff activated — wet pulse, heartbeat thump |
| 52 | `spell_verdant_ward.wav` | Nature barrier — leaves rustling, wooden creak, growth |
| 53 | `spell_harmony_ward.wav` | Balanced protective ward — gentle harmonic resonance |
| 54 | `spell_shadow_veil.wav` | Stealth shadow cloak — dark whisper, fabric whoosh |
| 55 | `spell_smoke_bomb.wav` | Smoke bomb thrown — fuse hiss, poof, smoke billow |
| 56 | `spell_poison_blade.wav` | Weapon coated in poison — liquid drip, sizzle on steel |
| 57 | `spell_lifetap.wav` | Convert health to mana — dark pulse, draining hum |
| 58 | `spell_acid_spit.wav` | Acid projectile spat — wet gurgle, sizzling launch |
| 59 | `spell_web_spit.wav` | Sticky web projectile — stretchy, gooey launch |

### Spell Fizzle (1)

| # | Filename | Description |
|---|---|---|
| 60 | `spell_fizzle.wav` | Spell fails to cast — sad fizzle, sputter, energy dissipate |

### Spell Impact (7)

| # | Filename | Description |
|---|---|---|
| 61 | `impact_fire.wav` | Fire spell hits target — explosion, searing burn |
| 62 | `impact_ice.wav` | Ice spell hits target — crystalline shatter, freeze crack |
| 63 | `impact_lightning.wav` | Lightning hits target — sharp electric crack, sizzle |
| 64 | `impact_shadow.wav` | Dark magic hits target — hollow thud, ghostly echo |
| 65 | `impact_holy.wav` | Holy spell hits target — bright chime burst, radiant ring |
| 66 | `impact_poison.wav` | Poison/acid hits target — wet sizzle, corrosive hiss |
| 67 | `impact_physical.wav` | Non-elemental spell hits target — blunt force thud |

### Weather (2)

| # | Filename | Description |
|---|---|---|
| 68 | `thunder.wav` | Lightning strike during heavy rain — thunder crack and roll |
| 69 | `rain_loop.wav` | Steady rain ambience — loopable, outdoor rainfall on stone |

### UI (1)

| # | Filename | Description |
|---|---|---|
| 70 | `level_up.wav` | Player learns a new spell / levels up — triumphant short fanfare |

---

## Source Files

| File | Purpose |
|---|---|
| `src/display/audio/audioEngine.js` | Core engine: AudioContext, buffer cache, buses, polyphony, spatial pan, looping |
| `src/display/audio/sounds.js` | Sound registry: ID → file path + bus + maxVoices + defaults |
| `src/display/audio/audioWiring.js` | Event hooks: world events → spatial playback |
| `src/display/audio/index.js` | Barrel export |
| `src/display/composition/setupDisplayRuntime.js` | Wiring entry point |
| `assets/audio/` | Sound file directory |

---

## Future Expansion

These 70 sounds are the **event-driven foundation** — every game action that fires an audio-relevant event is covered. Future layers build on top:

| Layer | Scope | Estimated Files |
|---|---|---|
| Creature vocalizations | Per-monster alert cries, death sounds, idle noises (bat screech, boar snort, wolf growl, etc.) | ~42–63 |
| Material impacts | Melee hit varies by weapon + target material (sword-on-flesh vs sword-on-bone vs club-on-stone) | ~15–25 |
| Footstep materials | Movement sound varies by surface (stone, grass, wood, water/mud) | ~4–8 |
| Biome ambience | Looping soundscapes per environment (dungeon drip, deep rumble, overworld birds, tavern bustle) | ~6–10 |
| NPC sounds | Townfolk activity (smith hammering, barkeep clatter, priest chanting) | ~10–15 |

The engine already supports all of these — spatial pan, bus mixing, polyphony, looping. They just need new sound files and new event hooks in the rules layer.
