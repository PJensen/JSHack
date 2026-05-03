# Mechanics Improvements

Six high-impact areas with concrete implementation plans. Ordered by player-visible impact.

---

## 1. AI Coordination — Geometric Spread & Brutal Pursuit

**Status:** Not started  
**Files:** `src/rules/systems/aiChaseSystem.js`, `src/rules/components/AggroState.js`

### Problem
Pack monsters alert each other via `packSense` but then independently beeline toward the player from identical angles. High-intel monsters lose the player and search randomly from their current position instead of anticipating movement. Result: fights feel like a damage race, not tactical.

### Solution

**Geometric spread (all pack monsters with `packSense`):**
- At step-selection time in `aiChaseSystem`, score each cardinal direction
- For each hunting ally of the same species within `packRadius`, compute that ally's normalized vector to the player
- Penalize (-2) any candidate direction within 45° of an ally's approach vector
- Take the highest-scoring direction
- Effect: goblins naturally fan out and flank without any global coordination state

**Flanker role (intel ≥ 7, 2+ allies already hunting):**
- The furthest hunting ally from the player becomes the "flanker" (derived each turn, no stored state)
- Flanker targets a position 4 tiles perpendicular to the direct player↔monster vector, paths there first, then closes
- Zero new components needed — derived from ally positions each turn

**Brutal pursuit — last-known anticipation (intel ≥ 8):**
- Add `lastKnownMoveDir: { dx: 0, dy: 0 }` to `AggroState`
- Each hunting turn, record player's facing/movement direction
- On LOS break: path to `lastKnownXY + (lastKnownMoveDir × 3)` — anticipates escape direction
- Only after reaching that tile does standard search begin
- Against predictable movement: terrifying. Against direction changes: monster mispredicts and reacquires.

**Reach last-known-position first (intel ≥ 7):**
- When `hunting → alerted`, path directly to `lastKnownXY` before starting the search spiral
- Currently: wandering begins from wherever the monster stands when LOS breaks

---

## 2. Retreat & Pursuit Behavior — Tactical Differentiation

**Status:** Not started  
**Files:** `src/rules/systems/aiChaseSystem.js`, `src/rules/components/AggroState.js`

### Problem
All retreating monsters behave identically: flip movement direction. A retreating lich and a retreating rat are indistinguishable. No kiting, no rallying, no chokepoint defense.

### Solution

**Kiting — ranged/casters:**
- On retreat, check if monster has `learnedSpellIds` or ranged weapon equipped
- If yes: don't flee past `maxRange - 2` tiles. At that distance, hold position (clear `MoveIntent`) and cast/shoot instead
- Retreat and offense become simultaneous

**Rally retreat — pack humanoids (intel 4–6):**
- Instead of fleeing directly away from player, move toward nearest hunting packSense ally
- Split pack reconverges under pressure
- If reconverged HP total exceeds a threshold, `retreating` flag auto-clears — "courage restored"

**Chokepoint defense — smart monsters (intel ≥ 7):**
- On retreat trigger, scan radius 8 for tiles with only 1 walkable cardinal neighbor (corridor tiles)
- Score by distance from player (closer = better — fight on their terms)
- Path to best candidate, then hold and fight facing the player
- Corridor fights become genuinely dangerous

---

## 3. Traps — Player-Proximity Arming + Intel-Gated Avoidance

**Status:** Not started  
**Files:** `src/rules/systems/trapSystem.js`, `src/rules/systems/aiChaseSystem.js`

### Problem
Monsters wander into traps during offscreen idle scurrying, robbing the player of the tactical satisfaction of witnessing trap kills. Trap arming is global — always active.

### Solution

**Arm gate:**
- `trapSystem` skips trigger evaluation when player is > 20 tiles away (same `ACTIVE_RADIUS` pattern as `aiChaseSystem`)
- Traps exist and are mappable, but don't fire offscreen
- Player enters room → traps go live → wandering monsters can now blunder in

**Intel-gated avoidance:**
- In `aiChaseSystem` step selection, before committing a move: if `brain.intelligence >= 6` and the candidate tile has a `Trap` component with `revealed: true` → treat as impassable
- Intel ≤ 3: blunder in normally
- Intel 4–5: no special avoidance (they might have heard rumors, but they're not smart enough to act on it)
- Intel ≥ 6: actively avoid revealed traps

---

## 4. Material Interactions — Content Fill

**Status:** Not started  
**Files:** `src/rules/data/materialReactions.js`, `src/rules/systems/materialReactionSystem.js`, `src/rules/systems/throwSystem.js`

### Problem
The declarative material reaction system is solid infrastructure but thin on content. Most of INTERACTIONS.md top-20 is unimplemented.

### Solution (four high-value reactions)

**Frozen + blunt → shatter:**
- Pre-damage hook: when target has `frozen` status and incoming type is `blunt`, multiply damage × 1.75
- Emit `proc:shatter` for VFX/audio
- One rule entry + `"shatter_bonus"` outcome handler

**Lightning hits water tile → electrify pool:**
- On `spell:hit` where spell school includes `electric` and target tile is water
- BFS flood-fill connected water tiles, set each as short-lived `ElectrifiedTile` hazard (3 turns)
- Any entity on an electrified tile takes shock damage that tick
- Bounded by water connectivity — can't blow up

**Burning gas + fire → explosion:**
- When `hazard:ignite` fires on a gas-type hazard (plasma cloud, poison cloud)
- Instead of normal damage: `dealDamage` AoE radius 3, destroy hazard entity, emit `world:explosion`

**Thrown potion at burning target → vaporize:**
- In `throwSystem.js`, on potion landing: check if target has `burning` status
- If yes: spawn `HazardArea` with the potion's effect type as medium instead of normal splash
- Poison potion → poison cloud, healing potion → healing aura, etc.

---

## 5. Item Identification — Canonical Per-Run Appearances

**Status:** Not started  
**Files:** `src/rules/data/runAppearances.js` (new), `src/rules/data/itemAppearances.js`, display wiring

### Problem
Identification scaffolding exists (`identification.js`, `itemAppearances.js`) but there is no random-appearance-per-run assignment. Items leak their true identity. The discovery loop — "what IS this murky green potion?" — is missing entirely.

### Solution

**`src/rules/data/runAppearances.js` (new ~60 lines):**
- On `initDungeon`, for each identifiable category (potions, scrolls, wands, rings, amulets):
  - Collect all item identities in that category from `ITEM_CATALOG`
  - Shuffle with `world.rand()` (deterministic per seed)
  - Assign one appearance string from a per-category pool ("Fizzy Red", "Murky Green", "Cloudy Blue", etc.)
- Store as `Map<identity, appearanceLabel>`
- Export `getAppearance(identity)` and `resetRunAppearances()`

**Display pipe:**
- `getUnidentifiedLabel` in `itemAppearances.js` calls `getAppearance(identity)` instead of returning generic "Unidentified Potion"
- Result: "Fizzy Red Potion" until you drink one and identify it — then all fizzy red potions become "Potion of Healing" everywhere

**Leak audit:**
- Audit `itemWiring.js` and inventory display for any path that exposes `ItemInfo.itemId` or `NamedIdentity.identity` without routing through the identification pipeline
- All item name resolution goes through `getDisplayName(world, id)` which checks `isIdentified` first

---

## 6. Multi-Axis Score

**Status:** Not started  
**Files:** `src/rules/components/Score.js`, `src/rules/systems/scoreSystem.js`, bridge, death screen

### Problem
`score.current` is a single integer: `maxHp × depth`. Tells you nothing about how you played. No foundation for a future leveling/progression system.

### Solution

Replace `Score.current` with named axes. No gameplay changes — purely richer accounting.

| Axis | Tracks | Hook |
|------|--------|------|
| `kills` | current maxHp×depth formula | unchanged |
| `depth` | deepest floor reached | `stair:traverse` |
| `exploredTiles` | unique walkable tiles stepped on | `moved` event |
| `survivorTurns` | turns spent at < 25% max HP | effectSystem tick |
| `scholarCount` | unique item types identified | `item:identified` |
| `executioner` | peak consecutive kills without taking damage | `died` + `damaged` |

Each axis is independently tracked via existing event hooks. Death/win screen shows breakdown. Future leveling system reads these same axes without further changes to scoring.

---

## Implementation Order

1. **AI Coordination** — highest player-visible impact, all in `aiChaseSystem.js`, no new components required
2. **Retreat/Pursuit Behavior** — builds on #1 infrastructure, same file
3. **Traps** — small change, large gameplay payoff
4. **Material Interactions** — content work, infrastructure ready
5. **Item Identification** — new module + display audit, self-contained
6. **Multi-Axis Score** — additive, no risk, do last
