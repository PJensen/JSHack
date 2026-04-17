# Hydraulic & Mechanical Dungeon Features

**Date:** 2026-04-17
**Files touched:** `src/rules/systems/hydraulicsSystem.js`, `src/rules/archetypes/RoomFeatures.js`, `src/rules/components/HydraulicsLink.js`, `src/rules/content/interaction/interactPayloads.js`, `src/rules/utils/hydraulicsUtils.js`, `src/rules/environment/dungeon/populate.js`

---

## Overview

The hydraulics system adds mechanical room features to dungeon dead-ends: portcullises that open/close, pressure plates that trigger them by weight, steam vents that pulse knockback+hazard lines, a flood gate wheel that fills tiles with water, and bone chime racks that make loud noise. These all run in the **effects** phase via `hydraulicsSystem`.

---

## The Linkage Model: `HydraulicsLink`

The binding primitive is a single component:

```js
HydraulicsLink { linkId: "", role: "" }
```

`linkId` is a string shared across every entity that belongs to the same mechanical circuit. `role` identifies what that entity *is* in the circuit:

| role | entity type | behavior |
|------|-------------|----------|
| `"portcullis"` | Portcullis gate | raised/lowered by anything with same `linkId` |
| `"plinth"` | PressurePlinth | reads tile weight, drives portcullises with same `linkId` |
| `"winch"` | ChainWinch | player-operated toggle, drives portcullises with same `linkId` |

The linkId generated at spawn time is `hyd:<depth>:<room.x>,<room.y>` — unique per room per floor.

A portcullis without a `linkId` does nothing (no circuit). A plinth or winch without a matching portcullis logs a no-op event but won't error.

---

## Features

### Portcullis (`portcullis` / `portcullis_raised`)

- Glyph: `⛓` (lowered), `┬` (raised)
- Has `HydraulicsLink { role: "portcullis" }`, `ObjectState { state: "lowered"|"raised" }`, `Collider { solid: true, blocksSight: true }` when lowered
- Raising flips `Collider.solid = false, blocksSight = false`
- Never operated directly by the player — always driven by a winch or plinth

### Chain Winch (`chain_winch`)

- Glyph: `⚙`
- Action: `operateChainWinch`
- Player interacts → toggles all portcullises sharing the same `linkId`
- Toggle logic: if any gate is lowered → raise all. If all raised → lower all.
- Updates own `ObjectState` to `"pull_up"` or `"pull_down"` for display

### Pressure Plinth (`pressure_plinth` / `pressure_plinth_pressed`)

- Glyph: `▣` (dark tan), `▣` (bright gold when pressed)
- Action: `inspectPressurePlinth` (player examine only; real logic in system)
- Every tick, `hydraulicsSystem` sums weight of all entities standing on the plinth tile:
  - Entity with `Weight.total > 0` → uses that value
  - Entity with `ItemInfo.weight` → weight × stack count
  - Entity with `Vitality` (but no Weight) → assumes 70 kg
- If total weight ≥ `thresholdWeight` (default 25 kg) → state becomes `"pressed"` → opens linked portcullises
- If weight drops below threshold → state returns `"unpressed"` → portcullises close
- State changes only emit events and update portcullises when the state *transitions* (not every tick)

### Steam Vent (`steam_vent`)

- Glyph: `≋`
- Action: `inspectSteamVent` (examine only; system drives behavior)
- Fires a line of `steam` HazardArea entities every tick on a deterministic cycle:
  ```
  active = (world.step % periodTurns) < activeTurns
  ```
- While active: spawns `spawnHazard(steam)` at each tile from distance 1 to `range` along the configured direction. Stops on non-walkable tile.
- Any `Vitality` entity in the line gets `KnockbackPending { dx, dy, force }` if not already knocked back
- Any `gas` or `steam` hazard in the line is pushed one tile further downrange (hazard propagation)
- Parameters (set at spawn, stored in `Interactable.params`):

| param | default | meaning |
|-------|---------|---------|
| `periodTurns` | 6 | full cycle length in ticks |
| `activeTurns` | 2 | how many ticks per cycle it fires |
| `range` | 4 | max tiles downrange |
| `dirX` / `dirY` | 0, 1 | direction unit vector (cardinal only) |
| `pushForce` | 1 | knockback force |
| `damage` | 2 | `tickDamage` applied to each steam hazard |

- Direction is cardinal only; if both `dirX` and `dirY` are set, `dirY` is zeroed.

### Flood Gate Wheel (`flood_gate_wheel`)

- Glyph: `◍`
- Action: `toggleFloodGateWheel`
- Player operates → toggles tiles in a Chebyshev square of radius `floodRadius` around the wheel between `TILE_FLOOR` and `TILE_SHALLOW_WATER`
- Standalone mechanic; not linked to portcullises or any other hydraulic entity
- State: `"open"` (flooding) or `"closed"` (drained)

### Bone Chime Rack (`bone_chime_rack`)

- Glyph: `#`
- Action: `ringBoneChime`
- Interaction sets `SoundEmitter.lastActionNoise = 88` (loud) on the source entity — this is read by the noise/alerting pipeline to alert monsters in earshot
- Emits `boneChime:rung` → message log: *"The bone chimes clatter and ring — the sound carries far."*

---

## Event Reference

| event | emitted by | payload fields |
|-------|-----------|----------------|
| `hydraulics:portcullis` | `setPortcullisRaised` (util) | `gateId, raised, state, source, at` |
| `hydraulics:plinth` | `processPressurePlinths` | `plinthId, linkId, pressed, thresholdWeight, totalWeight, gatesChanged, at` |
| `hydraulics:steamVent` | `processSteamVents` | `ventId, at, dir, range, damage, pushForce, pushedHazards` |
| `hydraulics:winch` | `operateChainWinch` payload | `actor, targetId, linkId, gatesChanged, raised` — or `ok:false, reason:"unlinked"` |
| `hydraulics:floodgate` | `toggleFloodGateWheel` payload | `actor, targetId, active, floodRadius, tilesChanged` |
| `hydraulics:plinthInspect` | `inspectPressurePlinth` payload | `actor, targetId, thresholdWeight, state` |
| `hydraulics:ventInspect` | `inspectSteamVent` payload | `actor, targetId, periodTurns, activeTurns, range` |
| `boneChime:rung` | `ringBoneChime` payload | `actor, targetId, at, sourceDbAt1Tile` |

---

## Shared Utility: `hydraulicsUtils.js`

Two functions live in `src/rules/utils/hydraulicsUtils.js` and are imported by both `hydraulicsSystem` and `interactPayloads`:

- **`setPortcullisRaised(world, gateId, raised, source)`** — sets `ObjectState`, flips `Collider`, emits `hydraulics:portcullis`
- **`setLinkedPortcullisState(world, linkId, raised, source)`** — iterates `HydraulicsLink` to find all portcullises with matching `linkId`, calls `setPortcullisRaised` on each changed one, returns change count

---

## Procedural Room Generation

The `hydraulics` dead-end room theme in `populate.js`:

1. Clears all monster/spawner spawns from the room
2. Generates a shared `linkId`
3. Places a **chain winch** (solid blocker) — links to all gates
4. Places a **pressure plinth** — links to same gates, threshold weight 20–40 kg
5. Places **1–2 portcullises** (solid blockers)
6. Places an optional **steam vent** (50/50 present, random cardinal direction and timing)
7. Places an optional **bone chime rack** (45% chance)

Flood gate wheel and drain throat exist in the spawn table but are not placed by the procedural room — they're reserved for hand-authored vaults.

---

## Adding a New Hydraulic Mechanism

1. Define an archetype in `RoomFeatures.js` with `HydraulicsLink` if it should join a circuit, or just `Interactable` if standalone
2. Add an entry to `SIMPLE_SPAWN_TABLE` in `populate.js`
3. If it's a circuit driver (new kind of trigger): add its `role` string, handle it in `hydraulicsSystem.js` (or a new system), call `setLinkedPortcullisState` from `hydraulicsUtils.js`
4. If it's player-operated: add a payload in `interactPayloads.js`
5. Wire display events in `environmentMessages.js`

---

## Known Gaps / Future Work

- **Steam vent VFX** — `hydraulics:steamVent` event is emitted but no particle/display wiring exists yet
- **Pressure plinth VFX** — `hydraulics:plinth` event has no float-text or particle feedback
- **Flood gate + drain throat connection** — `DrainThroat` archetype exists (palette entry `⊚`) but has no system logic; currently decorative only
- **Sound on portcullis** — `hydraulics:portcullis` triggers a log message but no audio
