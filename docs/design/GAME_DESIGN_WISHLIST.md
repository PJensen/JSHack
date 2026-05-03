# Game Design Wishlist

## Top Priority: Elemental Chaining

**The one thing that would make the game sing.**

This is **dungeon content**, not weather. Player creates both halves — that's what makes it legible and feel like mastery rather than luck.

**Combos:**
- Throw water potion → wet tiles in radius → zap with lightning spell → room arc
- Throw water potion → wet tiles → fire spell → steam cloud (blinds)
- Throw oil flask → oily tiles → fire → spreading burning floor
- Ice spell on burning tiles → extinguish + steam
- Poison cloud + fire → toxic cloud

**Architecture:**
- Sparse tile state map: `wet`, `burning`, `oily`, `poisoned` flags (not per-tile storage — just a `Map` keyed on `x|y`)
- Potion throw → splashes tile states in radius on land
- Spell/attack resolver checks destination tile state before applying → triggers interaction
- `statusInteraction` table: `{ wet+lightning → arc, wet+fire → steam, burning+ice → steam, oily+fire → burning, poisoned+fire → toxic_cloud }`
- Burning structures already tracked (destroyedTileLedger) — burning floor tiles reuse same extinguish logic

**Why:** Player caused both halves — they feel clever, not lucky. Creates "OH that's what that does" discovery moments — the soul of roguelikes. Every other system becomes more interesting.

---

## Loot

- **Artifact weapons with kill history** — `"Gutripper, slayer of 14 kobolds"` — cheap metadata on weapon entity, massive player attachment
- **Gem socketing into weapons** — uses material system already built; gems slot into weapon for enchant bonuses
- **Cursed items with upsides** — can't unequip the sword, but it whispers nearby monster positions (or similar)

---

## Mechanics

- **Push/throw** — shove monster into fire, pit, or other monster; one new intent + collision handler
- **Flanking** — adjacent ally (or summoned creature) gives attack bonus; single flag check in combatSystem
- **Trap crafting** — combine floor items to set ambushes (tripwire + potion)
- **Cross-species monster reactions** — predator/prey: rats scatter when wyvern enters, snakes swarm a corpse, weak monsters flee stronger ones even without player involvement. Add `preyOf: [...]` flag to monster defs; scan in aiChaseSystem for nearby predators. Makes dungeon feel like an ecosystem.

---

## Gameplay

- **Faction reputation** — kill enough undead → lich sends assassins; steal from town → bounty hunter spawns; uses intelligence tier + tag system already present
- **Dungeon mutation** — revisit a floor and it's changed: flooded, ritual in progress, vermin infestation
- **Trap crafting** — combine floor items (tripwire + potion) to set ambushes for monsters

---

## Atmosphere

- **Readable bones** — past player runs leave bones with cause of death; procedural epitaphs ("Here lies a rogue, slain by a kobold on floor 2")
- **Sound propagation** — combat noise travels rooms, curious monsters investigate; builds dread
- **Dungeon ecology** — mushroom patches spread, slimes reproduce, vermin eat food items on floor
