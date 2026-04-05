# New Druid Spells: Plague Swarm & Fireball

## Plague Swarm

> *Unleash a stinging swarm that burrows into the target and leaps to a new host every few turns.*

| Stat            | Value                          |
|-----------------|--------------------------------|
| Mana Cost       | 10                             |
| Cooldown        | 12 turns                       |
| Range           | 8 tiles                        |
| Targeting       | Auto (nearest hostile with LOS)|
| Schools         | Nature, Destruction            |
| Min Intelligence| 6                              |

### Mechanics

- Applies a **swarm** DOT to the target for **8 turns**.
- Damage per tick: **2 base** + INT scaling (~1 per 6 INT bonus).
- Every **3 ticks**, the swarm jumps to the nearest un-swarmed enemy within **6 tiles**.
- Maximum **3 jumps** per cast, spreading across a group of enemies.
- Each jumped copy inherits the remaining duration and potency of the source.
- Jumps only target faction-hostile enemies (never player, pets, or summons).
- Hit roll on initial cast; jumps are automatic (no miss chance).
- DOT ticks through the standard `effectSystem` damage pipeline (can be resisted by nature resistance).

### Jump Behavior

```
Turn 0: Cast on Enemy A (8 turns remaining)
Turn 3: Swarm jumps from A -> Enemy B (5 turns remaining on B)
Turn 6: Swarm jumps from A -> Enemy C (2 turns remaining on C)
         Swarm on B also jumps -> Enemy D (2 turns remaining on D)
```

Jumps propagate from any active swarm instance, creating a branching infection pattern. Each swarm effect tracks its own jump budget independently.

### VFX

- **Projectile**: Chaotic cloud of buzzing yellow-and-black particles with 6 orbiting "bee" dots.
- **Trail**: High-density particle emission (90/sec) alternating amber and dark motes.
- **Impact**: Amber flash + expanding ring + swarm particle burst.
- **Jump trail**: Same projectile VFX spawned between source and new host.
- **Light**: Amber glow (radius 3) follows the projectile.
- **Float text**: "SWARMED!" on initial hit (gold), "SWARM!" on each jump.

---

## Fireball

> *Hurl a roaring ball of fire that explodes on impact and leaves the target burning.*

| Stat            | Value                          |
|-----------------|--------------------------------|
| Mana Cost       | 8                              |
| Cooldown        | None                           |
| Range           | 10 tiles                       |
| Targeting       | Auto (nearest hostile with LOS)|
| Schools         | Destruction, Fire              |
| Min Intelligence| 6                              |

### Mechanics

- Deals **8 base fire damage** (INT-scaled, can crit).
- On hit (non-lethal), applies a **burn DOT for 2 turns** (potency 2, INT-scaled).
- Burn ticks use the standard `effectSystem` fire damage pipeline.
- Projectile delay scales with distance (speed 8, 0.1s-0.6s travel time).
- Uses standard spell hit/miss roll.

### VFX

- **Projectile**: Reuses the familiar fireball style -- fiery orange orb with trailing flame particles (80/sec), rising heat drift.
- **Trail**: Wide red glow + inner bright orange shaft.
- **Impact**: Radial burst (radius 0.7) + 18 fiery particles + 8 lingering smoke/ember motes.
- **Light**: Orange glow (radius 5) follows the projectile.
- **Float text**: "FIREBALL!" in red-orange on hit.
- **Burn**: Standard `proc:burning` event triggers existing burn VFX and status indicator.

---

## Files Modified

| File | What Changed |
|------|-------------|
| `src/rules/data/spells.js` | Spell definitions for both spells |
| `src/rules/scripts/spells.js` | Script handlers (`REGISTRY['plague_swarm']`, `REGISTRY['fireball']`) |
| `src/rules/data/effectDefs.js` | New `swarm` effect definition (damage operation, `swarmed` status) |
| `src/rules/systems/effectSystem.js` | Swarm jump logic in effect tick loop + `_processSwarmJumps` |
| `src/rules/data/classes.js` | Both spells added to Druid's `startingSpells` |
| `src/display/fx/projectileFx.js` | Plague swarm VFX (particles, draw, light, event listeners) + fireball event wiring |
| `src/display/ui/wiring/messageWiring.js` | Combat log messages for both spells + jump events |
| `src/display/ui/wiring/floatTextWiring.js` | Float text for both spells + jump events |
| `src/display/fx/spiritWispFx.js` | Wisp surge animations for both spells |
