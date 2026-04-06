# NetHack-Inspired Feature Ideas

Curated from a deep scan of the original NetHack C source.
JSHack is a **spiritual successor** — we cherry-pick the *feel*, not the implementation.

---

## FOUNTAINS (Priority: NOW)

NetHack fountains have 30+ random outcomes when quaffed. Current JSHack fountains
only heal/mana/poison. Expand the outcome table to include:

- **Summon water creature** — a water nymph or snake materialises (danger!)
- **Curse inventory** — a subset of carried items becomes cursed
- **See invisible** — temporary buff granting sight of invisible entities
- **Identify item** — a random unidentified item in inventory is revealed
- **Attribute boost** — brief stat buff (lucky, keen_eye, bear_vigor)
- **Teleport** — player randomly relocated on the floor
- **Gold generation** — coins bubble up from the depths
- **Gushing flood** — fountain explodes, creating shallow water tiles around it + destroys the fountain permanently
- **Wish (ultra-rare)** — "A water demon emerges... and grants you a boon!" — spawn a rare item from the loot table

Each drink should feel like pulling a slot machine lever. Particle bursts on every
outcome (blue sparkles for good, sickly green for bad, gold for treasure).

---

## CORPSE EATING FOR INTRINSICS

NetHack's most iconic system: eat a monster corpse, maybe gain its powers.

- **Eat fire ant corpse** → temporary fire resistance
- **Eat floating eye corpse** → brief telepathy/ESP
- **Eat nymph corpse** → teleport control or fey grace
- **Eat spider corpse** → poison resistance
- **Eat lichen corpse** → satiates hunger (never rots)
- **Bad corpses** — food poisoning, hallucination, stunning, stat drain
- Hook into existing `eat.js` callbacks; tie to monster tags
- VFX: stomach rumble particles, green sickness clouds, glowing aura on intrinsic gain

---

## ITEM DIPPING / ALCHEMY

Dip item A into item B for combined effects. NetHack's potion alchemy.

- **Weapon + Potion of Fire** → flaming weapon (temporary affix)
- **Weapon + Potion of Poison** → venomed blade (temporary affix)
- **Scroll + Potion of Water** → blank scroll (re-writable)
- **Gem + Potion of Water** → clean gem (identifies it)
- **Any item + Holy Water** → blessed beatitude
- **Any item + Unholy Water** → cursed beatitude
- Already have `can_dip_target`/`on_dip` hooks in catalog; extend the combinatorics
- VFX: item glows, particle trail from potion to weapon

---

## TRAP EXPANSION

NetHack has 25 trap types. We can add flavourful new traps:

- **Polymorph trap** — temporarily transforms player (use existing effect system)
- **Teleport trap** — random relocation on the floor
- **Squeaky board** — alerts all enemies in earshot (aggro burst)
- **Rolling boulder** — physics object that rolls in a direction, dealing big damage
- **Magic trap** — random status effect (good or bad)
- **Anti-magic trap** — drains mana completely
- **Rust trap** — corrodes equipped metal armour
- **Bear trap** — immobilises for N turns (already have Web; similar concept)

---

## PRAYER / DEITY DEEPENING

NetHack's prayer is a priority-based trouble solver. Current altar is basic.

- **Trouble priority queue** — deity fixes worst problem first:
  1. Petrification/stoning (if we add it)
  2. Disease/poison
  3. Hunger (critical)
  4. Low HP
  5. Cursed equipment
- **Alignment system** — actions shift lawful/neutral/chaotic
- **Deity anger** — pray too often → punishment (lightning, summon hostile angels)
- **Artifact bestowment** — rare prayer reward: unique named weapon with proc
- **Sacrifice value** — better offerings = better rewards

---

## KICKING

A whole new verb, cheap to implement with existing bump/movement infra.

- **Kick doors** — break locked doors (strength check, may hurt foot)
- **Kick objects** — launch items across the room (physics impulse)
- **Kick monsters** — martial arts attack, knockback
- **Kick fountains** — may release gems, may anger water spirits
- **Kick chests** — break open (destroys some contents)

---

## ENGRAVING

Write on the dungeon floor. NetHack's most flavourful verb.

- **Write with finger** — degrades quickly, free
- **Write with weapon** — lasts longer, dulls blade
- **Write with wand** — permanent, reveals wand type by the mark it leaves
- **Elbereth** — writing a sacred word repels undead (classic!)
- **Player messages** — leave notes for yourself on revisited floors

---

## BONES / GHOST SYSTEM

Die, and your ghost haunts that floor for future runs.

- **Bones file** — save dead player's floor state (items, ghost position)
- **Ghost encounter** — translucent sprite, phase-shifts through walls
- **Loot recovery** — dead player's equipment on the ground (cursed!)
- **Ghost AI** — territorial, haunts the room where you died
- Tie into existing seed system for deterministic ghost placement

---

## PET / FAMILIAR DEEPENING

NetHack pets are rich systems. We have familiar emitters already.

- **Tameness decay** — pets get wild without feeding
- **Pet combat** — pets independently fight enemies
- **Fetch behaviour** — pets retrieve items (apport stat)
- **Leashing** — item that tethers pet to player
- **Whistle** — recall tame creatures from anywhere on floor
- **Pet evolution** — well-fed pets grow stronger over time

---

## POLYMORPH

Transform into a monster form. Wild, emergent gameplay.

- **Polymorph potion/trap/wand** — random transformation
- **Gain monster abilities** — flight, wall-phase, fire breath, regeneration
- **Lose equipment** — armour breaks if new form is too large
- **Timed revert** — eventually change back
- **Monster-form combat** — use monster's attack dice instead of weapon
- Risk/reward: powerful forms are unstable

---

## HUNGER DEEPENING

NetHack has 7 hunger stages with escalating penalties.

- **Fainting** — random turn loss when starving
- **Hallucination from hunger** — world glitches when near death
- **Corpse nutrition values** — each monster type feeds differently
- **Cooking** — already have cooking system; tie corpses into it
- **Tin canning** — preserve corpses as tinned food (no rot)

---

## SHOPKEEPER RAGE

NetHack shopkeepers are terrifying when angered.

- **Theft detection** — walk out with unpaid goods → angry shopkeeper
- **Shopkeeper combat** — extremely high stats, call guards
- **Price haggling** — charisma-based discount system
- **Shop types** — weapon shops, potion shops, scroll shops, general stores
- **Credit system** — sell items for shop credit

---

## MISCELLANEOUS FUN

- **Touchstone** — identify gems by rubbing (already have dip hook for this)
- **Magic lamp** — rub for wish (one-time, ultra-rare)
- **Figurines** — items that become temporary allies when thrown
- **Tin whistle vs magic whistle** — one works, one doesn't (ID puzzle)
- **Stethoscope** — check monster HP by applying
- **Mirror** — reflect gaze attacks (floating eye counter!)
- **Bag of holding** — expanded inventory capacity
- **Loadstone** — cursed heavy stone you can't drop

---

## IMPLEMENTATION PRIORITY

1. **Fountains** — already have infrastructure, biggest bang for buck
2. **Corpse eating** — hooks exist, ties into monster identity
3. **Dipping/alchemy** — hook system ready, item combos are fun
4. **Trap expansion** — spatial system ready, just new trap types
5. **Kicking** — new verb, high fun-per-line-of-code ratio
6. **Prayer deepening** — altar exists, add priority queue
7. **Engraving** — new system but simple (text on tile)
8. **Everything else** — as inspiration strikes
