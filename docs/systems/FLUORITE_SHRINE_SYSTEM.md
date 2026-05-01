# Fluorite & Shrine Lighting System

## Overview

Three interlocking systems that make shrines feel alive and give fluorite a unique mechanical identity rooted in its real-world physics (fluorescence — the word literally comes from this mineral).

---

## Shrine Lighting (T1–T5)

### T1 — Deity Standing → Shrine Color & Radius

Shrine light is no longer static. It reads the player's normalized deity standing (−1 to +1) and adjusts each frame.

| Standing | Color | Radius | Feel |
|---|---|---|---|
| > 0.5 (highly favored) | `#ffeE8c` warm gold | 5.5 | Radiant, welcoming |
| 0.15–0.5 (favored) | `#e6cd64` rich gold | 4.8 | Warm presence |
| −0.15–0.15 (neutral) | `#ccaa33` default | 4.0 | Baseline |
| −0.5–−0.15 (disfavored) | `#9b8234` dim cool | 3.2 | Withdrawn |
| < −0.5 (wrath) | `#b9482a` reddish | 2.5 | Hostile embers |

Standing state is stored in `_shrineLightStates` (keyed by shrine entity ID), updated from `shrine:combat:scaling` events. Clears on floor transition.

### T2 — Communion Burst

On `shrine:communion`:
- **Blessing** → 0.8s gold bloom, radius 6 at shrine position
- **Cooldown** → subdued 0.3s flicker, radius 2.5

Also records `_lastShrineTouched` (per player) for miracle beam targeting.

### T3 — Shrine Charges Fluorite Gems

Holy light is treated as UV-adjacent (divine energy ≈ energetic radiation). Fluorite gems placed near a shrine slowly charge to full cyan glow.

- Charge rate: `falloff × 0.28 × dt × FLUO_CHARGE_RATE` per frame
- Falls off over 8 tile radius
- Reaches equilibrium near full charge (~4s adjacent)
- Uses existing `_fluoCharges` phosphorescence system — same cyan-green glow as lightning

### T4 — Combat Scaling Pulse

On `shrine:combat:scaling`:
- **Divine favor** (`mult > 1`) → 0.28s gold burst at shrine, radius 3.5
- **Divine wrath** (`mult < 1`) → 0.28s red flash at shrine, radius 3.5
- Also updates `_shrineLightStates` with the numeric standing value

### T5 — Miracle Beam

On `deity:intervention` with `kind: 'shrine_blessing'`:
- Holy beam drawn from shrine → player (uses existing `_holyBeams` system)
- Radiant bloom (radius 7, `HOLY_GOLD`) at shrine position
- 0.8s beam duration

---

## Fluorite Socket Proc — "Phosphorescent Discharge"

### Overview

Fluorite absorbs divine and electric energy, stores it as charge stacks, then releases as a blinding cyan flash on the next strike. The charging sources mirror real fluorescence physics: energetic radiation (lightning) charges it fast; ambient divine light (shrine) charges it slowly.

**Files:** `src/rules/data/gems.js`, `src/rules/data/gemSocketAffixes.js`

### Passive

**+20 `electricOhms`** — increases electrical impedance, reducing incoming electric/lightning damage. Thematically: the stone is already absorbing the energy it would otherwise take.

### Charge Sources

| Source | Stacks | Rate |
|---|---|---|
| Taking electric/lightning damage | +2 | Instant, per hit |
| Fighting near shrine in divine favor | +1 | Per combat hit while `shrine:combat:scaling` fires with `mult > 1` |
| Shrine ambient glow (floor gem) | Slow | T3 above — for gems on the floor, not socketed |

Max stacks: **6**. Discharge threshold: **3**.

### Discharge

Fires on `onBeforeHit` when stacks ≥ 3:

- **Bonus electric damage**: `stacks × 2` (6–12 at 3–6 stacks)
- **Blinds target**: 1 turn — the phosphorescent flash
- **Resets stacks to 0**
- Emits `proc:fluorite:discharge` for VFX

### VFX

Two-layer cyan bloom at target position:
1. Tight core — `[50, 245, 195]`, radius `4 + stacks × 0.4`, 0.55s
2. Wide phosphorescent wash — `[30, 200, 160]`, radius `6 + stacks × 0.6`, 0.35s

Float text:
- `"CHARGED"` / `"SHRINE CHARGE"` — when stacks reach max
- `"DISCHARGE!"` — on proc fire

### Item Description

```
Socketed: +20 electrical resistance.
Absorbs electric energy (taking lightning damage, fighting near a shrine in good standing).
At 3+ charges: next hit discharges as blinding phosphorescent flash — bonus electric damage + blinds target.
```

---

## Deity Fluorite Gift

When the player kills an enemy near a shrine while in high standing, there is a 12% chance the deity manifests a fluorite stone at the player's feet.

**Conditions:**
- Killer is the player
- Nearest shrine within 5 tiles (Chebyshev)
- `scoreDeityStanding(deity) >= 5` (out of ±8 cap — well-liked)
- `world.rand() < 0.12`

**Effect:**
- Fluorite gem entity spawned at player position via `materializeDrop`
- Log message: *"[Deity] is pleased. A phosphorescent stone materializes at your feet."*

**File:** `src/rules/systems/deitySystem.js`

---

## The Self-Reinforcing Loop

```
Shrine glows brighter when favored
    ↓
Shrine holy light charges nearby fluorite gems (visual glow)
    ↓
Fighting near shrine in divine favor charges socketed fluorite (+1/hit)
    ↓
Taking lightning damage near shrine charges it faster (+2/hit)
    ↓
At 3+ stacks: next attack → blinding cyan discharge + electric damage
    ↓
Killing near shrine with high standing → 12% chance deity gifts another fluorite
    ↓
Socket it → deeper into the loop
```

---

## Key Files

| File | Role |
|---|---|
| `src/rules/data/gems.js` | `gem_fluorite` socketable flag + detail lines |
| `src/rules/data/gemSocketAffixes.js` | Passive script, proc scripts (charge/discharge), shrine listener |
| `src/rules/systems/combatSystem.js` | `shrine:combat:scaling` now carries `shrineId/shrineX/shrineY` |
| `src/rules/systems/deitySystem.js` | Fluorite gift on kill near shrine |
| `src/display/lighting/sources/index.js` | All shrine lighting reactivity + fluorite discharge VFX |
| `src/display/ui/wiring/floatTextWiring.js` | CHARGED / DISCHARGE! float text |
| `src/display/ui/wiring/messages/environmentMessages.js` | Deity gift log message |
