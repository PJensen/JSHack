# Technical Memo: Dungeon Type System

**Date:** 2026-03-07
**Status:** Approved for implementation
**Scope:** `src/rules/environment/dungeon/`

---

## Decision Summary

| Question | Decision |
|---|---|
| What does a profile control? | Geometry **and** population — theme merges into profile |
| How is a profile selected? | One profile per whole floor, picked in `floorPlan.js` |
| Do all types use BSP? | No — arenas/catacombs use BSP; caves/grottos use dedicated generators |
| Cave post-processing? | Per-profile: caves get corner erosion only; grottos get full cellular automata |

---

## Architecture

### The Profile Object

A `dungeonProfile` is a plain JS object. Each dungeon type is a named export from `profiles/index.js`. The profile is chosen once per floor and stored on `FloorPlan`.

```js
// Minimum shape of a profile
{
  // Identity
  id: 'catacombs',        // string key
  theme: 'crypt',         // display-layer theme (replaces floorPlan.theme)

  // Generator: if present, called instead of BSP pipeline
  // Signature: (rng, CHUNK_SIZE) => Uint8Array tiles
  generator: null,        // null = use BSP

  // BSP parameters (ignored if generator is set)
  bspMaxDepth:    5,
  minLeafSize:    5,
  minRoomSize:    3,
  maxRoomSize:    7,
  roomMargin:     1,
  splitRatioMin:  0.40,
  splitRatioMax:  0.60,

  // Corridor + doors (BSP only)
  corridorWidth:  1,      // 1 = single-tile, 2 = wide
  doorChance:     0.6,

  // Post-process hook (both BSP and generator types may use this)
  // Signature: (tiles, rng, CHUNK_SIZE) => void  (mutates in place)
  postProcess:    null,

  // Population hints (read by populateChunk)
  hazardBias:     null,   // null | 'water' | 'lava' | 'ice'
  monsterFilter:  null,   // null | fn(monsterDef) => bool
  featurePool:    null,   // null | string[] override for room features
  doorFeatureRate: 0.5,   // fraction of non-entry rooms that get a feature
  shopChance:     0.3,
}
```

### File Structure (new files in bold)

```
src/rules/environment/dungeon/
  constants.js          ← unchanged (still exports TILE_* and default BSP constants)
  bsp.js                ← MODIFIED: accepts profile instead of reading constants directly
  chunk.js              ← MODIFIED: generateChunk(..., profile), dispatches to generator
  floorPlan.js          ← MODIFIED: adds profile to FloorPlan; calls pickProfile
  index.js              ← MODIFIED: threads profile through generateFloor → generateChunk
  populate.js           ← MODIFIED: reads floorPlan.profile for population hints
  profiles/
    index.js            ← NEW: all profiles + pickProfile(rng, depth)
    default.js          ← NEW: wraps current BSP constants (crypts/sewers/mines/temples)
    catacombs.js        ← NEW: BSP tight — tomb cells, lots of doors
    arenas.js           ← NEW: BSP wide — large chambers, no doors
    caves.js            ← NEW: CA generator profile
    grottos.js          ← NEW: blob generator profile
  generators/
    cellular.js         ← NEW: cellular automata tile generator
    blob.js             ← NEW: drunk-walk blob generator
```

---

## Dungeon Type Specifications

### Default (Standard BSP)
*Crypts, sewers, mines, temples — current behavior.*

| Field | Value |
|---|---|
| generator | null (BSP) |
| bspMaxDepth | 5 |
| minRoomSize / maxRoomSize | 3 / 7 |
| roomMargin | 1 |
| splitRatioMin/Max | 0.40 / 0.60 |
| doorChance | 0.6 |
| postProcess | null |

---

### Catacombs
*Maze of tight tomb cells. Grid-like regularity, many doors, claustrophobic.*

| Field | Value | Reason |
|---|---|---|
| generator | null (BSP) | Rectangular cells = BSP's strength |
| bspMaxDepth | 7 | More splits → more, smaller cells |
| minLeafSize | 4 | Allow tighter partitions |
| minRoomSize / maxRoomSize | 3 / 4 | Tomb-sized cells |
| roomMargin | 0 | Cells butt against partition walls |
| splitRatioMin/Max | 0.45 / 0.55 | Near-even splits → grid regularity |
| corridorWidth | 1 | Narrow passages |
| doorChance | 0.9 | Near-every doorway gets a door |
| postProcess | null | Geometry is already tight |
| theme | 'crypt' | |
| hazardBias | null | |

---

### Arenas
*Large open chambers connected by short corridors. Combat-forward.*

| Field | Value | Reason |
|---|---|---|
| generator | null (BSP) | Large rooms still rectangular |
| bspMaxDepth | 3 | Fewer, larger partitions |
| minLeafSize | 8 | Ensure partitions are large enough for big rooms |
| minRoomSize / maxRoomSize | 6 / 12 | Big chambers |
| roomMargin | 1 | Standard margin |
| splitRatioMin/Max | 0.35 / 0.65 | Uneven splits → varied chamber sizes |
| corridorWidth | 2 | Wide connecting passages |
| doorChance | 0.0 | No doors — open combat flow |
| postProcess | null | |
| theme | 'abyss' or 'temple' | |
| hazardBias | 'lava' | Lava pits in chambers |
| featurePool | ['statue', 'altar', 'chest'] | Combat/reward focus |

---

### Caves
*Organic natural caverns. BSP skeleton, corner-erosion post-process.*

| Field | Value | Reason |
|---|---|---|
| generator | null (BSP) | BSP gives connectivity skeleton |
| bspMaxDepth | 3 | Fewer, larger partitions |
| minLeafSize | 8 | Large partitions for wide rooms |
| minRoomSize / maxRoomSize | 5 / 11 | Big rooms that will erode into blobs |
| roomMargin | 0 | Rooms can nearly touch — merges after erosion |
| splitRatioMin/Max | 0.30 / 0.70 | Very uneven splits = irregular cavern sizes |
| corridorWidth | 2 | Wide corridors that erode further |
| doorChance | 0.0 | No doors in a cave |
| postProcess | `cornerErosion` | Opens corners, widens passages organically |
| theme | 'cave' | |
| hazardBias | 'water' | Shallow pools, underground lakes |

**`cornerErosion(tiles, rng, CHUNK_SIZE)`:**
For every TILE_WALL tile, if ≥ 3 of its 4 orthogonal neighbours are TILE_FLOOR, convert it to TILE_FLOOR. Run 2 passes. Safe: only gains floor, never loses it. Connectivity guaranteed.

---

### Grottos
*Vast underground spaces, wet and open. Dedicated blob generator.*

| Field | Value | Reason |
|---|---|---|
| generator | `blobGenerator` | BSP rooms discarded; blob shapes instead |
| bspMaxDepth | — | N/A |
| postProcess | `cellularAutomata` | Full CA smoothing after blob fill |
| corridorWidth | — | N/A (generator handles corridors) |
| doorChance | 0.0 | |
| theme | 'cave' or 'sewer' | |
| hazardBias | 'water' | Heavy water features |

**`blobGenerator(rng, CHUNK_SIZE)`:**
1. Fill array with TILE_WALL.
2. Pick 3–5 random seed points in the interior.
3. Drunk-walk from each seed for `CHUNK_SIZE * CHUNK_SIZE * 0.35` steps, carving TILE_FLOOR.
4. Return tiles (edge gates and CA post-process applied after).

**`cellularAutomata(tiles, rng, CHUNK_SIZE)`:**
Standard B3/S12345 automaton (born if 3 floor neighbours, survives if 1–5). Run 4 iterations. Then: flood-fill from the largest connected region; any TILE_FLOOR not in the main region → TILE_WALL (connectivity repair). No isolated blobs escape.

---

## Threading the Profile

### FloorPlan additions
```js
// floorPlan.js — generateFloorPlan returns:
{
  ...existing fields,
  profile: pickProfile(rng, depth),   // replaces theme string
  theme: profile.theme,               // kept for display-layer backward compat
}
```

### generateChunk signature change
```js
// chunk.js
export function generateChunk(worldSeed, depth, chunkX, chunkY, profile) {
  // ...
  let tiles;
  if (profile.generator) {
    tiles = profile.generator(rng, CHUNK_SIZE);
  } else {
    // existing BSP pipeline, passing profile for BSP constants
    const tree = buildBSP(0, 0, CHUNK_SIZE, CHUNK_SIZE, rng, profile);
    placeRooms(tree, rng, profile);
    carveRooms(tree, tiles, CHUNK_SIZE);
    connectRooms(tree, tiles, CHUNK_SIZE, rng, profile);
  }
  if (profile.postProcess) profile.postProcess(tiles, rng, CHUNK_SIZE);
  // edge gates + door detection continue unchanged
}
```

### bsp.js signature change
BSP functions receive `profile` as a final param and read constants from it:
```js
buildBSP(x, y, w, h, rng, profile = DEFAULT_PROFILE)
```
`constants.js` defaults remain unchanged; `DEFAULT_PROFILE` in `profiles/default.js` mirrors them.

### populate.js
Reads `floorPlan.profile.hazardBias`, `floorPlan.profile.featurePool`, `floorPlan.profile.doorFeatureRate`, etc. Falls back gracefully to existing logic when fields are null.

---

## `pickProfile(rng, depth)` — Selection Logic

```
depth  0           → overworld (no profile)
depth  1–3         → 'catacombs' (70%) or 'default' (30%)
depth  4–8         → 'default' (40%), 'caves' (30%), 'catacombs' (30%)
depth  9–15        → 'caves' (35%), 'grottos' (30%), 'arenas' (20%), 'default' (15%)
depth  16+         → 'grottos' (35%), 'arenas' (35%), 'caves' (30%)
```

---

## Implementation: Vertical Slices

Each slice is independently testable. Complete and validate each before starting the next.

### Slice 1 — Profile infrastructure + BSP param threading
*Goal: BSP reads from profile object; catacombs profile is live in-game.*

- [ ] Create `profiles/default.js` — mirrors current `constants.js` BSP values
- [ ] Create `profiles/catacombs.js`
- [ ] Create `profiles/index.js` — exports all profiles, `pickProfile`
- [ ] Modify `bsp.js` — accept `profile` param, read BSP constants from it
- [ ] Modify `chunk.js` — accept `profile`, pass to BSP functions; wire `corridorWidth`, `doorChance`
- [ ] Modify `floorPlan.js` — add `profile` field, call `pickProfile`
- [ ] Modify `index.js` — pass `floorPlan.profile` → `generateChunk`
- **Validation:** Depth 1–3 generates catacombs-style. Nav tests still pass.

### Slice 2 — Arenas profile
*Goal: Arenas profile functional with large-room BSP.*

- [ ] Create `profiles/arenas.js`
- [ ] Update `pickProfile` weights to include arenas
- **Validation:** Arenas appear at depth 9+. Rooms are visibly larger.

### Slice 3 — Cave generator (BSP + corner erosion)
*Goal: Caves use BSP + `cornerErosion` post-process.*

- [ ] Implement `cornerErosion` in `generators/cellular.js`
- [ ] Create `profiles/caves.js` referencing `cornerErosion`
- [ ] Update `pickProfile` to include caves
- **Validation:** Caves visibly organic. No isolated floor regions. Nav tests pass.

### Slice 4 — Grotto generator (blob + full CA)
*Goal: Grottos use drunk-walk blob generator + CA smoothing.*

- [ ] Implement `blobGenerator` in `generators/blob.js`
- [ ] Implement `cellularAutomata` (with connectivity repair) in `generators/cellular.js`
- [ ] Create `profiles/grottos.js`
- [ ] Update `pickProfile` to include grottos
- **Validation:** Grottos are open, cave-like. Connectivity repair verified. Nav tests pass.

### Slice 5 — Population integration
*Goal: Profile drives hazard tiles, feature pool, door feature rate.*

- [ ] Modify `populate.js` — read `floorPlan.profile` for population hints
- [ ] Add `hazardBias`, `featurePool`, `doorFeatureRate` fields to all profiles
- **Validation:** Catacombs have no lava. Grottos have water features. Arenas have altars/chests.

---

## Invariants That Must Not Break

1. **Edge gates** — all generators must produce a navigable tile at the 4 edge gate positions (post-process must not re-wall them). Edge gates are carved *after* post-process.
2. **Stair carving** — forced up-stairs carve an L-corridor to the nearest room; the corridor finder must still work for blob/CA floors (it scans for any nearby TILE_FLOOR, so it should).
3. **`populateChunk` solid-check** — stairs and spawners already guard against `isSolid`; no change needed.
4. **Determinism** — every generator is seeded from `chunkSeed(worldSeed, depth, cx, cy)`. No `Math.random()`.
5. **Nav tests** — `tests/nav.test.mjs` must pass after every slice.

---

## Open Question (deferred)

> *"I have a suspicion only 1 chunk is being generated and traversable by the player right now."*

Likely cause: `dungeonScale = 0.3` → `stairOffset = 0` at depth 1–3 → all stairs land in chunk (0,0) → extent is only that chunk + 1 padding. Investigate separately after slices 1–2 are stable. The multi-chunk nav test (`tests/nav.test.mjs`) should surface this.

---

*End of memo.*
