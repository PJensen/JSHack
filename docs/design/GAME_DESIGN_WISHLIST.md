# Game Design Wishlist

## Top Priority: Elemental Chaining

**The one thing that would make the game sing.**

Status combos: wet (rain/water potion) + lightning scroll = room arc. Burning + ice = steam blind. Poison + fire = toxic cloud. Infrastructure half-exists: weather sets wet tiles, burning structures already tracked. One `statusInteraction` lookup table + a few emitters.

**Why:** Creates "OH that's what that does" discovery moments — the soul of roguelikes. Every other system becomes more interesting.

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
