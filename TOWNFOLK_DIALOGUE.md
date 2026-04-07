# Townfolk Activity-Reactive Dialogue System

## Overview

NPCs on the overworld react to what the player has done — kills, dungeon depth, quests completed, items carried — through both bump-to-talk dialogue and unprompted proximity barks (speech bubbles).

---

## 1. PlayerActivity Component

New singleton component on the player entity. Accumulates stats from existing world events.

**File:** `src/rules/components/PlayerActivity.js`

```js
defineComponent("PlayerActivity", {
  totalKills:       0,
  deepestFloor:     0,
  dungeonVisits:    0,
  questsCompleted:  "",   // comma-separated quest IDs
  lastKilledSpecies:"",   // identity of most recent kill
  bossKills:        0,    // tier >= 5 monsters
  deaths:           0,    // player death count
  goldSpent:        0,
  potionsDrunk:     0,
  spellsCast:       0,
})
```

Strings instead of arrays/objects because ECS components are flat. Parse with `.split(",")` where needed.

**Register in:** `src/rules/components/index.js`

---

## 2. PlayerActivity Tracking System

New listener-based system — no per-tick query, just event subscriptions installed once.

**File:** `src/rules/systems/playerActivitySystem.js`

```
installPlayerActivityListeners(world)
```

Listens to:

| Event | Updates |
|-------|---------|
| `died` (non-player entity, player is killer) | `totalKills++`, `lastKilledSpecies`, `bossKills` if tier >= 5 |
| `died` (player entity) | `deaths++` |
| `dungeon:transitioned` | `deepestFloor = max(deepestFloor, depth)`, `dungeonVisits++` on depth 1 |
| `dialog:reported` (quest turn-in) | append questId to `questsCompleted` |
| `item:purchased` or gold deducted | `goldSpent += amount` |

**Install in:** `src/main/scheduler.js` → `configureWorld()`, alongside other install calls.

**Note:** The `died` event payload is `{ id, killer }`. Check `killer` exists and is the player entity to attribute kills. Get species from `NamedIdentity.identity` on the dead entity. Get tier from `getMonster(identity)?.tier`.

---

## 3. Activity-Reactive Dialogue Lines

Extend the existing `ambientTownfolkText()` function in `src/rules/dialogues/townfolkDialogs.js`.

### Line Pool Structure

Each NPC role gets a priority-ordered array of `{ text, condition }` entries. The function picks the **first matching** line, falling back to the existing bulletin-based or default text.

```js
const LINE_POOLS = {
  smith: [
    { text: "That's dwarf-lord steel on your hip. You've been deep.",
      cond: a => a.deepestFloor >= 4 },
    { text: "Heard you cleared the rats. Barkeep won't shut up about it.",
      cond: a => hasQuest(a, "ratInfestation") },
    { text: "You look like you've swung a blade or two. Need anything repaired?",
      cond: a => a.totalKills >= 10 },
  ],
  farmer: [
    { text: "You smell like the dungeon. The cows don't like it.",
      cond: a => a.dungeonVisits >= 3 },
    { text: "Careful down there. We buried the last adventurer out back.",
      cond: a => a.deaths >= 1 },
  ],
  priest: [
    { text: "The dead stir below. I feel it. You've seen it too.",
      cond: a => a.deepestFloor >= 3 },
    { text: "You carry the weight of many souls. The gods take notice.",
      cond: a => a.totalKills >= 30 },
    { text: "I heard you recovered the old book. The church is safer for it.",
      cond: a => hasQuest(a, "starterPriestFetch") },
  ],
  barkeep: [
    // (barkeep already has quest-driven dialogue — these are ambient extras
    //  shown when no quest node is active)
    { text: "Back again? You're becoming a regular. Stew's on.",
      cond: a => a.dungeonVisits >= 5 },
    { text: "Word travels. They say you've been to the fourth floor and lived.",
      cond: a => a.deepestFloor >= 4 },
  ],
  herbalist: [
    { text: "You've been drinking potions like water. Save some for the rest of us.",
      cond: a => a.potionsDrunk >= 5 },
    { text: "The deeper roots have stranger properties. Bring me samples.",
      cond: a => a.deepestFloor >= 2 },
  ],
  miner: [
    { text: "Heard there's ore veins down on the third level. Tempted to go myself.",
      cond: a => a.deepestFloor >= 3 },
    { text: "You've got a killer's look about you. Watch where you point that thing.",
      cond: a => a.totalKills >= 20 },
  ],
  woodcutter: [
    { text: "If you find any ironwood down there, I'll pay double.",
      cond: a => a.dungeonVisits >= 2 },
  ],
  mason: [
    { text: "The deeper you go, the worse the cracks get up here. Something's shifting.",
      cond: a => a.deepestFloor >= 3 },
  ],
  alchemist: [
    { text: "A seasoned delver! I could use monster parts. Bring me what you find.",
      cond: a => a.totalKills >= 15 },
  ],
  villager: [
    { text: "My cousin went down those stairs and never came back. Be careful.",
      cond: a => a.dungeonVisits >= 1 },
    { text: "They say you killed something terrible down there. Is it true?",
      cond: a => a.bossKills >= 1 },
  ],
};
```

### Integration Point

In `ambientTownfolkText(def, ctx)`:

```js
function ambientTownfolkText(def, ctx) {
  const fallback = String(def?.dialogue || "Good day.");

  // --- NEW: check activity lines first ---
  const pool = LINE_POOLS[def?.role];
  if (pool) {
    const activity = getPlayerActivity(ctx.world);
    if (activity) {
      for (const entry of pool) {
        if (entry.cond(activity)) return entry.text;
      }
    }
  }

  // --- existing bulletin-based variation ---
  switch (String(def?.role || "")) {
    case "smith":    return smithAmbientText(ctx, fallback);
    // ... etc
  }
  return fallback;
}
```

`getPlayerActivity(world)` queries for the single `[Player, PlayerActivity]` entity and returns the component data.

---

## 4. Proximity Bark System

NPCs speak unprompted when the player walks nearby — no bump required.

### Approach

Add a bark check inside the existing `aiTownfolkSystem.js` rather than a new system. At the top of each NPC's tick, if the player is within Chebyshev distance 3 and cooldown has expired, emit `npc:dialogue` (already wired to speech bubbles via `speechBubbleWiring.js`).

### New Fields on TownfolkJob

```js
barkCooldown: 0,   // turns until next bark allowed
```

### Bark Logic (pseudocode)

```
if (depth !== 0) return;
if (job.barkCooldown > 0) { job.barkCooldown--; return; }
if (chebyshevDist(npc, player) > 3) return;
if (chebyshevDist(npc, player) < 1) return;  // skip if bump-talking distance

const activity = getPlayerActivity(world);
const line = pickBarkLine(job.role, activity);
if (!line) return;

world.emit("npc:dialogue", { actor: npcId, text: line });
job.barkCooldown = 40 + Math.floor(world.rand() * 40);  // 40-80 turns
```

### Bark Lines vs Talk Lines

Barks are **short, one-line** reactions (no choices, no dialogue tree). They use a separate pool from the bump-to-talk lines but share the same condition structure. Barks should feel like overheard remarks, not directed conversation.

```js
const BARK_POOLS = {
  smith: [
    { text: "*hammering intensifies*", cond: () => true },
    { text: "Steel sings when you fold it right.", cond: () => true },
    { text: "Another one back from the deep...", cond: a => a.dungeonVisits >= 2 },
  ],
  farmer: [
    { text: "Rain's coming. Good for the turnips.", cond: () => true },
    { text: "That adventurer's been busy...", cond: a => a.totalKills >= 10 },
  ],
  priest: [
    { text: "*murmurs a prayer*", cond: () => true },
    { text: "The gods grow restless.", cond: a => a.deepestFloor >= 3 },
  ],
  villager: [
    { text: "Fine day, isn't it?", cond: () => true },
    { text: "Did you hear something from the dungeon?", cond: a => a.dungeonVisits >= 1 },
  ],
  // ... etc for all roles
};
```

---

## 5. Wiring Summary

No new event types needed. Everything flows through existing infrastructure:

```
[world events: died, dungeon:transitioned, dialog:reported]
        │
        ▼
  playerActivitySystem (listeners update PlayerActivity component)
        │
        ▼
  ┌─────────────────────────────┐
  │  ambientTownfolkText()      │ ← bump-to-talk (existing dialog system)
  │  reads PlayerActivity       │
  │  picks first matching line  │
  └─────────────────────────────┘
        │
  ┌─────────────────────────────┐
  │  aiTownfolkSystem bark      │ ← proximity (new bark block)
  │  reads PlayerActivity       │
  │  emits npc:dialogue         │
  └─────────────────────────────┘
        │
        ▼
  speechBubbleWiring.js (already handles npc:dialogue → speech bubble)
  messageWiring.js (already logs npc:dialogue to message log)
```

---

## 6. Files Changed

| File | Change |
|------|--------|
| `src/rules/components/PlayerActivity.js` | **NEW** — component definition |
| `src/rules/components/index.js` | Add `PlayerActivity` export |
| `src/rules/systems/playerActivitySystem.js` | **NEW** — event listeners |
| `src/rules/components/TownfolkJob.js` | Add `barkCooldown: 0` field |
| `src/rules/dialogues/townfolkDialogs.js` | Add `LINE_POOLS`, modify `ambientTownfolkText()` |
| `src/rules/systems/aiTownfolkSystem.js` | Add bark proximity block + `BARK_POOLS` |
| `src/main/scheduler.js` | `installPlayerActivityListeners(world)` call |
| `tests/townfolkBark.test.mjs` | **NEW** — bark cooldown, line selection, activity conditions |

---

## 7. Future Extensions

- **Seasonal/time-of-day lines** — condition on `CalendarState` (already a singleton)
- **Weather lines** — condition on `WeatherState.current` ("Lovely rain today")
- **Relationship memory** — track how many times player talked to each NPC, unlock deeper lines
- **Gossip propagation** — NPCs share info: if player talks to barkeep about rats, smith mentions it next
- **Mood system** — NPC mood affected by economy state (from district bulletins), shifts line tone
