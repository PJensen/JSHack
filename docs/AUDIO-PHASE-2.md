# Audio Phase 2 — Prospective Sound Needs

Phase 1 covers all mechanical game events: combat, spells, items, weather, UI, ambience.
Phase 2 fills creature voices, missing/stub sounds, spell coverage, the spirit wisp, and synthesis opportunities.

**The audio engineer has full synthesis capability** — sounds marked `[synth]` are ideal for original synthesis work rather than samples.

---

## Priority 0 — Stubs / Broken Wiring

### Portcullis raise / drop
`hydraulics:portcullis` fires with `{ raised: bool }` — no audio handler exists. Needs files + 3 lines in `audioWiring.js`.

| File | Description | Bus |
|------|-------------|-----|
| `portcullis_raise` | Heavy chain feeding through iron pulley, slow mechanical grind ~1.5s, ends with dull thud locking open. `[synth]` layered chain noise + mechanical resonance. | ambient |
| `portcullis_drop` | Instant gravity drop, massive metal gate slamming stone. Brutal ~0.4s hit + 1.2s reverb tail. | ambient |

### spell:consecrate
`file: null` in registry — explicit stub.

| File | Description |
|------|-------------|
| `spell_consecrate` | Sacred resonance materializing on stone. Tuning fork struck on marble, harmonic bloom. NOT a bang. NOT a bell toll. More like sound *becoming* holy. `[synth]` — pure tone with controlled overtone swell. ~1.0s |

---

## Priority 1 — Spirit Wisp

The spirit wisp is a fully realized VFX entity — it orbits the player, surges toward spell targets, flares on deity miracles, reacts to combat, dims at low standing, and settles onto the player corpse at death. **It has zero audio.**

This is the most synthesis-rich opportunity in the entire game. The wisp is otherworldly, ethereal, tiny. Its sounds should feel like light made audible — barely-there at rest, reactive when active.

All timings below are derived directly from the FX constants in `src/display/fx/spiritWispFx.js`.

---

### `wisp_hum_calm` + `wisp_hum_combat` — seamless loops

The hum runs the entire time the wisp is alive. Two states:

- **Calm** — orbit speed `1.4 rad/s` = ~4.5s per revolution. Slow, wide.
- **Combat** — orbit speed `4.0 rad/s` = ~1.6s per revolution. Tight, agitated. Returns to calm in **2.0s** after last hit.

The wisp also pulses its light at **1.8 Hz** (0.56s cycle) and bobs vertically at **2.2 Hz** (0.45s cycle). For a seamless loop that feels coherent with the visual rhythm, target **~3.3s** (6× the light pulse cycle). The two frequencies don't share a clean LCM so longer is fine — any length where LFO start = LFO end will work.

`[synth]` FM carrier, very low modulation index, sine-ish. Pitch ~1.8–2.2kHz. Gentle LFO tremolo. Combat variant: same carrier, faster tremolo rate, slight harmonic edge.

**Bus:** ambient · **vol:** ~0.12 · **max voices:** 1 per variant

---

### `wisp_surge` — one-shot

Wisp darts from player to spell target alongside the projectile. Duration is computed as `dist / speed`, hard capped at **0.7s**, floor at **0.06s**. Typical spell range 3–8 tiles at speed 8–14 → **0.2–0.5s** in practice.

File must feel complete even if only 0.2s is heard. Fast attack essential — if the transient arrives late the sync is lost. Target file length **0.4–0.5s**, front-loaded.

`[synth]` short pitch-rise, airy shimmer release. Tail can decay naturally.

**Bus:** ambient · **max voices:** 3 · **randomPitch:** 30

---

### `wisp_flare` — one-shot

Fires when wisp arrives at target. Spell surge holds **0.3s** at impact (`SURGE_FLARE_TIME`); miracle flight holds **0.4s** (`MIRACLE_FLARE_TIME`). Compressed light releasing.

`[synth]` fast transient, bright shimmer decay. Target **0.3–0.5s**.

**Bus:** spells · **max voices:** 1

---

### `wisp_miracle_flight` — one-shot (optional split)

Full deity miracle sequence: flies out at **12 tiles/sec**, flares for 0.4s, returns at **8 tiles/sec**. At typical range (4–8 tiles): ~0.33–0.67s out, ~0.5–1.0s back. Total round trip **~1.5–2s**.

Can be one arc file (departure shimmer → bright peak at halfway → gentler return fade) or split into `wisp_miracle_out` + `wisp_miracle_return`. Single file is simpler for the engine.

**Bus:** spells · **max voices:** 1

---

### `wisp_harvest_loop` + `wisp_harvest_absorb` — loop + one-shot

Two-part sequence triggered when the wisp circles a vanquished enemy:

1. **1.8s of calm** must pass after combat before harvest activates (`HARVEST_LINGER_DELAY`)
2. Wisp circles the corpse for **2.4s** (`VANQUISH_CIRCLE_DURATION`)
3. Absorption burst fires — wisp glow flares for **0.55s** (`HARVEST_FLARE_DURATION`)

`wisp_harvest_loop` should be a **~2.4s loop** — a slow, rising, satisfied swell. Cuts to `wisp_harvest_absorb` on absorption: **0.5s** glass harmonic peak.

`[synth]` loop = glass harmonic, very slow attack, building resonance. Absorb = single bright ping with clean decay.

**Bus:** ambient · **max voices:** 2

---

### `wisp_death_vigil` — seamless loop (long)

Player dies → wisp circles for **2.2s** (`DEATH_CIRCLE_DURATION`), then eases down to the corpse tile over **6.2s** (`DEATH_LAND_DURATION`). Total time to settle: **~8.4s**. After that the wisp holds indefinitely until game-over screen.

This is **not a one-shot**. Needs a seamless loop that starts mournful and stays mournful. Engine fades it out on scene transition.

Suggested approach: a **~5–6s loop** starting at the death event, with enough internal variation to not feel mechanical over 10–15s of hold time.

`[synth]` slow pitch fall settling into sustained minor resonance. Should feel like a lantern being cupped — warmth withdrawing but light remaining.

**Bus:** ambient · **vol:** ~0.35 · **max voices:** 1 · **fadeOut:** 2.0s on stop

---

### `wisp_spell_boost` — one-shot

Fires on `spirit:spellBoost`, one microtask before the actual spell cast event. Layered *under* the spell sound, not over it — should add resonance without competing.

`[synth]` mid-high resonant ping. **0.3–0.5s**.

**Bus:** spells · **max voices:** 2

---

### `wisp_guidance` — one-shot

Guidance tip fires, wisp active for **2.0s** pointing at target (`GUIDANCE_PULSE_DURATION`). Sound should sit comfortably under that window.

`[synth]` gentle two-tone chime. "Pay attention, not alarm." **0.5–0.8s** with tail decaying within 2s.

**Bus:** ui · **max voices:** 1

---

### `wisp_prayer` — one-shot

Player prays — wisp spirals inward then eases back out over **1.2s** (`PRAYER_SPIRAL_DURATION`).

`[synth]` soft contemplative shimmer, inward-feeling. **0.8–1.2s**.

**Bus:** ambient · **max voices:** 1

---

### Quick-reference timing table

| File | Type | Duration | Key constant |
|------|------|----------|-------------|
| `wisp_hum_calm` | loop | ~3.3s | `BASE_ORBIT_SPEED 1.4`, `LIGHT_PULSE_FREQ 1.8 Hz` |
| `wisp_hum_combat` | loop | ~3.3s | `COMBAT_ORBIT_SPEED 4.0`, decays in `COMBAT_DECAY 2.0s` |
| `wisp_surge` | one-shot | 0.4–0.5s (front-loaded) | cap `0.7s`, floor `0.06s` |
| `wisp_flare` | one-shot | 0.3–0.5s | `SURGE_FLARE_TIME 0.3s` / `MIRACLE_FLARE_TIME 0.4s` |
| `wisp_miracle_flight` | one-shot | ~1.5–2s | fly `12 t/s` out, `8 t/s` back |
| `wisp_harvest_loop` | loop | ~2.4s | `VANQUISH_CIRCLE_DURATION 2.4s` |
| `wisp_harvest_absorb` | one-shot | ~0.5s | `HARVEST_FLARE_DURATION 0.55s` |
| `wisp_death_vigil` | loop | ~5–6s | `DEATH_LAND_DURATION 6.2s` + `DEATH_CIRCLE_DURATION 2.2s` |
| `wisp_spell_boost` | one-shot | 0.3–0.5s | fires 1 microtask before spell cast |
| `wisp_guidance` | one-shot | 0.5–0.8s | `GUIDANCE_PULSE_DURATION 2.0s` window |
| `wisp_prayer` | one-shot | 0.8–1.2s | `PRAYER_SPIRAL_DURATION 1.2s` |

---

### Mood-colored hum variants (optional bandwidth)

The wisp changes color with deity mood (wrath=red, serenity=blue, sorrow=indigo, amusement=yellow, chaos=purple). Distinct tonal registers per mood create a passive information layer — same loop structure, different FM character:

- **wrath** — slightly dissonant, buzzy undertone
- **serenity** — purest tone, widest, most peaceful
- **sorrow** — slower modulation, minor coloring
- **amusement** — bright, quick tremolo
- **chaos** — subtle bitcrush or pitch instability

---

## Priority 2 — Spell Coverage Gaps

### Spells with zero audio

These spell IDs exist in `spells.js` and fire events, but have no entry in `sounds.js`. All go on `spells` bus.

| Spell ID | Used by | Description | Synth notes |
|----------|---------|-------------|-------------|
| `spell:arcane_bolt` | Monster spellcasters | Generic arcane projectile. Should feel crisp, academic, precise. `[synth]` clean sine click + short flutter tail. |  |
| `spell:scorch` | Fire mage line | Single-target fire DoT ignition. Distinct from `fireball` — tighter, more clinical. | Needle of heat. |
| `spell:drain_life` | Lich, dark casters | Life energy being sucked toward caster. `[synth]` inward whoosh, slightly wet/organic. | |
| `spell:summon_skeleton` | Lich | Bones assembling from nothing. `[synth]` bone rattle burst + rising summoning tone. | Great synth opportunity |
| `spell:gaze_beam` | Floating eye | The paralyzing stare locked on. Currently the gaze stun pip progress (`proc:gaze:charged`) has no sound at all — a building tone that rises each pip would be terrifying. `[synth]` rising carrier frequency, 5 discrete steps. | High priority |
| `spell:thorn_burst` | Druid, nature | Thorns erupting from ground. `[synth]` organic crack + rustling impact. | |
| `spell:natures_touch` | Druid | Healing through nature contact. Warmer, more earthen than `flash_heal`. | |
| `spell:barkskin` | Druid | Bark armor manifesting on skin. `[synth]` woody creak + thud. | |
| `spell:leech_spores` | Druid/marsh | Spores attaching and draining. `[synth]` puff + wet settle. | |
| `spell:bog_curse` | Marsh witch | Curse + bog environment. Burbling mud + hex accent. | |
| `spell:ignite_weapons` | Warrior/smith | Blade igniting. `torch:ignite` exists — could alias, or needs distinct "magical ignition" variant. | |
| `spell:iron_flesh` | Warrior | Stone/iron skin hardening. `[synth]` metallic resonance tightening inward. | |
| `spell:primal_roar` | Shaman/beast | Different from `war_cry` — raw, animal, pre-language. `[synth]` low formant roar. | |
| `spell:mark_of_death` | Dark casters | Target marked for death. `[synth]` single low doom resonance. | |
| `spell:quicken` | Any | Speed boost. `[synth]` short rapid flutter/shimmer. | |
| `spell:shrieker_scream` | Shrieker plant | Alarm screech (distinct from creature alert). Very loud, percussive. | |
| `spell:bat_shriek` | Bat | Sonic attack. Ultrasonic-flavored burst. `[synth]` high freq flutter hit. | |
| `spell:holy_strike` | Paladin | Weapon strike empowered with holy. `smite` + impact layered. Could alias `spell:smite`. | |
| `spell:blind` | Various | Vision cut. `[synth]` mid-freq thud + reverb swallowing everything. | |
| `spell:snake_fang` | Snake | Venom injection. Short hiss + wet hit. Could alias `snake_alerted` + impact. | |
| `spell:rat_gnaw` | Rat | Gnawing bite. Could alias `rat_attack_1`. | |
| `spell:boar_bite` | Boar | Tusk gore. Could alias `cave_bear_attack`. | |
| `spell:cheap_shot` | Bandit | Dirty hit. Short, cheap-sounding knock. | |
| `spell:savage_strike` | Troll/ogre | Brutal hit. Already covered well by combat pack — alias heavy impact. | |
| `spell:poison_spit` | Spider/acid | Liquid projectile launch. `[synth]` wet plosive. | |
| `spell:evocation` | Generic caster | Channel → release. Alias `spell:channeling` or `spell:bolt`. | |
| `spell:homecoming` | Hearthstone return | Return teleport to overworld. Should feel warm, distinct from combat blink. | |
| `spell:hearthstone` | Same | Same event different name possibly. | |
| `spell:fishing` | Fishing rod use | Casting line. Light whoosh + water plop. Low priority. | |
| `spell:goblin_dirty_trick` | Goblin | Trick/taunt. Short mischievous sound. | |

### Spells with weak/mismatched placeholders

These have audio but it's aliased to something thematically wrong or generic:

| Spell ID | Current file | Problem | Ideal |
|----------|-------------|---------|-------|
| `spell:blastwave` | `spell_earthshatter_1` | Earthshatter is stone/ground. Blastwave is compressed AIR. | `[synth]` resonant low boom with fast-pressure whoosh. Concussion feeling. |
| `spell:firestorm` | `spell_fire` | Same as single fireball. Firestorm is multiple pillars, chaotic, sustained. | `[synth]` overlapping fire bursts, denser than fireball. |
| `spell:blizzard` | `spell_frost` | Same as basic frost bolt. Blizzard is a storm. | `[synth]` cold wind swell building to white noise texture. |
| `spell:death_volley` | `spell_agony` | Agony is a moaning magic swell. Death volley is skeletal archers firing in rapid succession. | Rapid impact burst, fusillade texture. |
| `spell:divine_shield` | `spell_buff` | Generic buff sound. Divine shield should resonate like holy metal. | `[synth]` metallic resonance + radiant shimmer. |
| `spell:verdant_ward` | `spell_buff` | Generic. Nature ward should feel organic — leaves, bark, green. | `[synth]` organic rustle + nature magic shimmer. |
| `spell:harmony_ward` | `spell_buff` | Generic. Harmony ward is literally harmonic resonance. | `[synth]` clean chord voicing, warm pad. |
| `spell:rampage` | `spell_lifetap` | Lifetap is a blood-drain sound. Rampage is warrior berserker rage. | `[synth]` war-drum pulse + low growl surge. |

---

## Priority 3 — Monster Voices

### Alert sounds (none for these monsters)

When a monster spots the player, `status { kind: 'alert' }` fires spatially. Add to `ALERT_SOUND_BY_IDENTITY` in `audioWiring.js`.

**Humanoid tier:**

| File | Monsters | Character | Bus |
|------|----------|-----------|-----|
| `goblin_alert` | goblin, loot_goblin, hobgoblin | Surprised bark — "Oi!" quality, high-pitched, mean | combat |
| `orc_alert` | orc, orc_shaman, orc_warchief | Guttural challenge grunt, low register | combat |
| `human_alert` | bandit, bandit_archer, bandit_captain | Human shout of alarm, grounded | combat |
| `troll_alert` | troll, ogre | Wet confused sniff + growl, gurgling | combat |
| `demon_alert` | demon | Infernal roar, deep and flanged | combat |

**Undead tier:**

| File | Monsters | Character |
|------|----------|-----------|
| `lich_alert` | lich | Necromantic incantation fragment, 3–5 syllables of nothing. Low, deliberate. `[synth]` formant-shifted voice. |
| `wraith_alert` | wraith | Rushing hollow wind resolving to a whisper. |
| `wight_alert` | wight | Low moan building to start of a screech (cut short). |

**Beast/other:**

| File | Monsters | Character |
|------|----------|-----------|
| `bat_alert` | bat, flaming_bat | Burst of high-frequency chittering |
| `dire_wolf_alert` | dire_wolf | Long threatening low growl + snarl |
| `cockatrice_alert` | cockatrice | Clucking hiss, bird + reptile |
| `floating_eye_alert` | floating_eye | Rising electronic/organic hum — the machine charging |
| `shrieker_alarm` | shrieker | Plant-based alarm screech. LOUD. Percussive. |
| `mimic_reveal` | mimic | Wooden creak transitioning to monster snarl. `[synth]` great opportunity. |

### Death sounds (all fall back to generic)

| File | Monsters | Character |
|------|----------|-----------|
| `goblin_died` | goblin, loot_goblin | Squeal or choked yell |
| `orc_died` | orc (all) | Low death grunt, exhale |
| `troll_died` | troll, ogre | Slow wet collapse sound |
| `cave_bear_died` | cave_bear | Massive beast death roar cutting to silence |
| `spider_died` | spider (all) | Hissing screech + crunch |
| `rat_died` | rat | Pained squeak |
| `lich_died` | lich | Explosion of necrotic energy — bone + void. `[synth]` excellent candidate. |
| `wraith_died` | wraith | Fast dissipation, vacuum closing. `[synth]` |
| `dragon_died` | dragon, dragon_whelp | Epic falling roar. Long. This is a MOMENT. |
| `wight_shriek` (upgrade) | wight | Currently `spell_agony.mp3`. Needs real banshee wail. `[synth]` female voice formant, rising, breaks into static. |

### Attack vocalizations (only cave_bear, rat, spider, insects covered)

| File | Monsters | Character |
|------|----------|-----------|
| `snake_attack` | snake, pit_viper, cave_snake | Short percussive hiss-bite |
| `bat_attack` | bat, flaming_bat | Screech + wing-beat forward hit |
| `dire_wolf_attack` | dire_wolf | Explosive snarl/snap |
| `dog_bark` | dog pet | Short loyal bark (currently plays `pet_meow_1`) — functional bug |

---

## Priority 4 — Interaction & Mechanic Sounds

| ID | Trigger | Description |
|----|---------|-------------|
| `identify` | Scroll of identify / identify spell | Knowledge flash. `[synth]` short ascending arpeggio or bright chime with shimmer tail. `ui` bus. |
| `proc:gaze:charged` | Floating eye pip progress (currently visual only) | Rising tone per pip — 5 pips total. `[synth]` each pip increments pitch 20%. Terrifying when you hear it building. |
| `proc:chain_lightning` | Chain lightning jumping between targets | Short crackle per jump. Alias `status:electrocuted` at lower volume, or `[synth]` quick spark burst. |
| `gas_spore_explode` | Gas spore death | Wet pop + cloud release. `[synth]` organic plosive + hiss. |
| `rust_corrode` | Rust monster corroding a weapon | Hissing acid on metal. `[synth]` sizzle + minor pitch drop. |
| `level:up` | Level gained | Currently reuses `quest_complete`. Should feel like *power arriving*, not accomplishment. `[synth]` punchy upward energy hit. |
| `npc:harvest` | Farmer harvesting | Rustling crop, basket drop. Low vol, spatial. |
| `npc:shop:greet` | Merchant proximity | Short vocal bark — 3–4 variants. |

---

## Priority 5 — Footstep Materials

Player moves every turn — currently silent. Even subtle footsteps dramatically increase presence. 2–3 variants per surface, randomPitch 40, vol ~0.18.

| ID | Surface | Character |
|----|---------|-----------|
| `footstep:stone` | Dungeon corridors/rooms | Dry, hard, slight echo. Classic dungeon step. |
| `footstep:grass` | Overworld grass/dirt | Soft, irregular, living ground. |
| `footstep:wood` | Tavern/house interiors | Hollow creak, interior warmth. |
| `footstep:wet` | Water tiles, mud | Splash or squelch. |

> Requires new event hook — movement doesn't currently emit audio. Would need a footstep emitter in movement or a display-layer tile-check on player movement.

---

## Priority 6 — Depth Ambience Layers

Dungeon reverb already scales with depth (`0.20` at floor 1, caps `0.45`). Distinct ambience per depth band would give each zone character without needing full biome tracks.

| ID | Depth | Character |
|----|-------|-----------|
| `ambient:dungeon:drip` | All dungeon | Irregular water drip. Fires on occasional random timer in wet areas. Single shot, not a loop. |
| `ambient:dungeon:deep` | Floors 3–4 | Low stone groan, subsurface resonance. Loop. `[synth]` excellent. |
| `ambient:dungeon:abyss` | Floor 5+ | Profound silence broken by distant rumble. `[synth]` infrasound texture. |

---

## Synthesis Wishlist (engineer's canvas)

These are sounds where synthesis would be **superior** to sampling — novel textures that don't exist in nature:

| What | Why synth wins |
|------|---------------|
| **Wisp ambient hum** | No real-world referent. Should feel physically impossible. FM synthesis ideal. |
| **Wisp flare / surge** | Instant, controlled transient shaping. Sampled equivalents sound wrong. |
| **Floating eye gaze build** | Needs exact pitch steps per pip. Trivial in synth, impossible to sample well. |
| **Lich death** | Necrotic energy + bone + void — three textures in one. Layered oscillators + noise shaping. |
| **Wraith dissipation** | Vacuum-closing inward whoosh — reversal + filter sweep. |
| **Consecrate** | Sacred resonance with controlled harmonic series. Additive synthesis ideal. |
| **Portcullis drop** | Heavy transient with long tail — synthesis gives full control over room acoustics. |
| **Harmony ward** | Actual chord voicing. Should be a recognizable musical interval. |
| **Blizzard** | Cold white noise texture with formant sweeps. |
| **Blastwave** | Concussion pressure wave — sub-bass transient + fast air movement. |
| **Summon skeleton** | Bone rattle burst with rising summoning tone. Granular synthesis of noise bursts. |
| **Primal roar** | Formant-shifted voice into animal register. Vocoder / formant filter. |

---

## File count summary

| Category | Files needed |
|----------|-------------|
| Broken/stub fixes (portcullis, consecrate, stair fix) | 4 |
| Spirit wisp | 6–10 |
| Spell gaps — zero coverage | ~20 (many can alias existing or each other) |
| Spell upgrades — mismatched placeholders | 8 |
| Monster alerts | ~10 |
| Monster deaths | ~10 |
| Monster attacks | 4 |
| Interaction / mechanic | 6 |
| Footsteps | ~10 |
| Depth ambience | 3 |
| **Total new files** | **~80** |

Many spells with "zero coverage" can share files (e.g., `spell:goblin_dirty_trick` ≈ `spell:cheap_shot`; `spell:boar_bite` can alias `cave_bear_attack`). Realistic unique file count is closer to **~55–60**.
