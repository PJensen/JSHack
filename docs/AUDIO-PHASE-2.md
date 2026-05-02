# Audio Phase 2 — Prospective Sound Needs

Phase 1 covers all mechanical game events: combat, spells, items, weather, UI, ambience.
Phase 2 fills creature voices, missing/stub sounds, spell coverage, the spirit wisp, and synthesis opportunities.

**The audio engineer has full synthesis capability** — sounds marked `[synth]` are ideal for original synthesis work rather than samples.

---

## Orphaned Files (on disk, not used)

These files exist in `assets/audio/` but nothing in the registry points to them. They were either replaced or never wired:

| File | What replaced it | Notes |
|------|-----------------|-------|
| `stair_ascend`, `stair_descend` | `transition_coating.mp3` (both directions) | Dedicated files exist — just need registry entries pointing at them. Easy win. |
| `move_boulder`, `move_boulder_alt` | `action_move_boulder.mp3` | Same content, renamed. Registry could use both as a `files: []` array for variation. |
| `eat_food` | `action_eat.mp3` | Same. Could become a variant. |
| `equip_weapon` | Combat pack equip sounds | Legacy file. Could be a fallback for exotic weapon types not in combat pack. |
| `melee_hit`, `melee_hit_alt`, `melee_crit`, `melee_miss` | Combat pack impact/whoosh | Original melee sounds, now superseded. Possibly delete. |
| `melee_shield_hit_1–6` | `SHIELD METAL/WOOD-Deflect-*` pack | Superseded. |
| `chest_opened` | `chest_open.mp3` | Minor naming variation. Merge or drop. |
| `player_death_1` | `player_death.mp3` (`player:death`) | Registry maps `player:death` → `player_death.mp3`, `player:death:heavy` → `player_death_2.mp3`. `player_death_1` is unreachable. |
| `pickup_scroll_or_this` | `pickup_scroll.mp3` | Stale alternate. |

---

## Priority 0 — Stubs / Broken Wiring

### stair:ascend / stair:descend
Dedicated files exist on disk but are never played — both stair directions use `transition_coating.mp3`. One registry edit activates them:

```js
"stair:descend": { file: "stair_descend.mp3", bus: "ambient" },
"stair:ascend":  { file: "stair_ascend.mp3",  bus: "ambient" },
```

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

### Ambient (loop while active)

| ID | Description | Notes |
|----|-------------|-------|
| `wisp:hum` | Soft orbital hum. Barely present, like a faint electrical shimmer 3 octaves above normal hearing range brought just into audibility. Modulates slowly. `[synth]` FM carrier with very low index, sine-ish, pitch ~1.8–2.2kHz, gentle LFO tremolo. | Loop, ambient bus, vol ~0.12, max 1 voice |

The hum should tighten and quicken in combat (orbit speed increases), slow in calm. Ideally the engine would pitch-shift it in real-time, but a separate `wisp:hum:combat` variant works if that's simpler.

### One-shots

| ID | Description | Notes |
|----|-------------|-------|
| `wisp:surge` | Wisp darts to spell target or guidance target. Short forward whoosh with ethereal shimmer trailing. `[synth]` short pitch-rise + airy release. ~0.3s. | ambient, max 3, randomPitch 30 |
| `wisp:harvest` | Wisp circles a killed enemy, absorbing essence. A rising, satisfied tone — like a small bell being rubbed into resonance. `[synth]` glass harmonic, slow attack, ~0.6s. | ambient, max 2 |
| `wisp:flare` | Deity miracle delivery. Wisp reaches target, flares bright, returns. Compressed light releasing. `[synth]` fast transient + bright shimmer decay. ~0.5s. | spells, max 1 |
| `wisp:death_vigil` | Player dies — wisp slowly descends onto corpse and holds. Mournful, fading shimmer. Should feel like a lantern being cupped. `[synth]` slow pitch fall, ~4s fade. | ambient, max 1 |
| `wisp:spell_boost` | Spirit amplifies a spell (`spirit:spellBoost` event). A resonant pulse layered on top of the spell cast sound. `[synth]` mid-high resonant ping. ~0.4s. | spells, max 2 |
| `wisp:guidance` | Tip fires — wisp pulses to draw attention. Gentle two-tone chime. "Pay attention, not alarm." `[synth]` soft bell dyad. ~0.5s. | ui, max 1 |
| `wisp:mood:shift` | Optional — when deity mood changes noticeably (wrath → serenity etc.) a brief audio telegraph. `[synth]` pitch glide matching mood color. ~0.3s. | ambient, max 1 |

### Mood-colored hum variants (optional)

The wisp changes color with deity mood (wrath=red, serenity=blue, sorrow=indigo, amusement=yellow, chaos=purple). If the engineer has bandwidth, distinct tonal registers per mood create a passive information layer:

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
