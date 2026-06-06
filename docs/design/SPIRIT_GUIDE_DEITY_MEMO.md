# Spirit Guide As Deity

Date: 2026-06-06
Status: Technical design memo

This memo captures a design direction: the spirit guide is not only a tutorial
wisp or deity conduit. It is the visible edge of the deity's mind. The deity is
quietly responsible for many of the player's troubles and rescues: monsters
arriving from behind, traps appearing ahead, loot showing up at the right time,
and a healing potion waiting just before disaster.

The dungeon should still feel precomputed. The truth is stranger: the world is
being authored around the player just outside perception. The deity is not
optimizing fairness, challenge rating, or simulation purity as an end in itself.
It is optimizing player fun.

## Goal

Create a deterministic deity-authorship layer that lets the deity shape runs through
offscreen interventions while preserving the illusion that the dungeon was there
all along.

The desired player experience:

- The player feels watched, helped, tested, and occasionally manipulated.
- Good fortune and bad fortune both feel diegetic, not like a difficulty slider.
- The spirit guide can be read as helpful, but later understood as complicit.
- The dungeon remains coherent: interventions use ordinary monsters, traps,
  loot, and terrain rules.
- The player may suspect but never prove that the deity is authoring the run.

## Core Premise

The spirit guide is the deity's local avatar. It is not the source of power by
itself; it is the interface through which the deity observes, whispers, nudges,
and hides intent.

Recommended framing:

- `Deity` owns mood, favor, boredom, surprise, wrath, serenity, and amusement.
- A new deity policy layer converts divine state plus player state into
  concrete intervention proposals.
- Existing canonical systems perform the actual work: monster materialization,
  loot materialization, trap creation, status application, and messages.
- The spirit wisp visualizes only the parts the deity wants the player to
  notice.

The guide can therefore give advice about a trap it arranged, point at loot it
planted, warn about a monster it released, or stay silent because the lesson is
more entertaining that way.

## Deity Contract

The deity should answer one question each turn or at sparse intervals:

```txt
What small change, just outside player knowledge, would make the next few turns
more interesting?
```

That answer should become an intervention, not an immediate mutation whenever
possible.

Recommended intervention shape:

```js
{
  kind: "pressure" | "relief" | "temptation" | "lesson" | "wrath" | "miracle",
  deityId,
  playerId,
  reason: "low_health" | "boredom" | "overconfidence" | "starving" | "favor",
  target: { x, y },
  payload: { type: "monster" | "item" | "trap" | "omen", id: "..." },
  budgetCost: 1,
  expiresTurn: 1234,
}
```

The intervention should be explicit enough for tests, debug overlays, death
records, and future replay inspection.

## Offscreen Law

The deity may cheat only outside the player's reliable knowledge.

Allowed placement zones:

- Outside current FOV.
- In fog-of-war tiles the player has never seen.
- In previously seen tiles only if there is a plausible carrier: a wandering
  monster, collapsing wall, summoned hazard, divine flash, shop restock, or
  other visible fiction.
- Behind doors, around corners, inside containers, under corpses, or in rooms
  not currently observed.

Disallowed by default:

- Creating an ordinary monster in current FOV.
- Adding an ordinary trap to a currently visible floor tile.
- Replacing a known empty tile with loot without a visible cause.
- Moving the stairs or hard progression affordances as an invisible prank.
- Invalidating deterministic replays by using timers, async, fetch, or
  `Math.random()`.

If a visible violation is desired, it *must* be framed as a direct miracle,
wrath event, hallucination, or explicit reality break.

## Fun Signal

The deity needs a compact, deterministic readout of player state. It should
not try to infer fun from every variable at once.

Useful signals:

- Danger: current HP, nearby enemies, status burden, escape options, darkness.
- Relief need: low health, no healing item, starvation, trapped path, mana
  starvation for caster builds.
- Boredom: turns since combat, turns since loot, repeated safe movement, low
  monster pressure.
- Overpressure: recent damage spikes, repeated failed actions, too many adjacent
  enemies, no reachable safe tile.
- Competence: recent kills, clean trap avoidance, successful spell/item combos,
  pet survival, shrine play.
- Greed and temptation: visible-but-risky loot routes, cursed or unknown items,
  chests, shrines, fountains, corpses.
- Divine relationship: favor, wrath debt, boredom/amusement, pantheon patron
  shifts, prayer cadence.

These should become normalized integer or fixed-point values. Avoid floats if
the surrounding rules code can stay simpler and more testable with integers.

## Intervention Families

### Pressure

Pressure makes the player move, spend resources, or improvise.

Examples:

- Spawn a monster behind or to the side of the player, outside FOV.
- Wake a dormant spawner after the player has grown comfortable.
- Route a wandering enemy toward a noise or scent trail.
- Place a mild trap near a strong loot route.
- Create a shrine drawback if the player has been exploiting divine favor.

Pressure should respect recent harm. It should not pile onto a player who just
took a severe damage spike unless the deity is explicitly wrathful.

### Relief

Relief prevents frustration from becoming a dead run.

Examples:

- Place a healing potion in an unexplored side room.
- Put food near a starving player, but on the far side of a small risk.
- Bias loot toward a missing basic tool such as ranged ammo or a light source.
- Spawn a weak enemy whose corpse or drop solves a short-term need.
- Trigger a spirit guide hint that makes an existing option legible.

Relief should usually cost the player time, risk, or attention. The best rescue
is not a free gift on the current tile; it is a believable opportunity.

### Temptation

Temptation creates stories by offering a questionable choice.

Examples:

- Put a chest near a trap route.
- Place an unidentified potion before an upcoming status threat.
- Spawn a shrine, altar, or offering opportunity when divine mood is unstable.
- Offer powerful loot that requires passing near a sleeping enemy.

Temptation is where the spirit guide can become morally interesting: it may point
at exactly the thing that will solve the problem and create the next one.

### Lesson

Lesson interventions teach rules without feeling like tutorial text.

Examples:

- Put a visible trap in a safe corridor before a harsher trap appears later.
- Place water, lightning, and a vulnerable enemy close enough to suggest an
  interaction.
- Let the wisp warn once, then allow consequences.
- Use low-stakes monsters to introduce status effects before high-stakes fights.

Lessons should prefer existing mechanics over bespoke tutorial content.

### Wrath And Miracle

Wrath and miracle are allowed to be more visible because the fiction supports
them.

Examples:

- A wrathful deity reveals a trap only as it arms.
- A serene deity manifests a potion at the player's feet.
- A hungry deity demands an offering by spoiling a greedy route.
- An amused deity releases a strange but survivable monster.

These should route through existing `deity:wrath`, `deity:miracle`, and
`deity:intervention` vocabulary where practical.

## Topology

Do not store deity-authorship history as arrays on the player or deity component.
Runtime multiplicity should be child entities.

Recommended components:

- `DeityAuthorshipState`
  - attached to a deity or player-deity relationship
  - stores coarse budget, cooldowns, and current pressure/relief scores

- `DeityIntervention`
  - child runtime entity
  - stores planned intervention kind, target, payload, reason, expiry, and
    visibility policy

- `DeityAuthorshipMemory`
  - optional child runtime entity for recent interventions
  - supports cooldowns such as "do not place two emergency potions in a row"

This keeps deity authorship auditable and compatible with the runtime topology
doctrine.

## Scheduling

Deity authorship should be deterministic rules code, not display wiring.

Recommended integration:

- A sparse rules system in the `effects` phase evaluates player state and
  enqueues intervention entities.
- A later rules system materializes due interventions through canonical helpers.
- Display/main spirit guide wiring only visualizes outcomes and speech.
- Existing deity mood events can feed the authorship layer, but it should not
  import display code or call UI directly.

The deity policy layer should not run every expensive search every turn. It can tick every
N turns, on room entry, on damage spikes, on prayer, on floor transition, and on
important resource thresholds.

## Placement

Placement must use reachability and spatial helpers, not full-map guesswork.

Placement requirements:

- Candidate tile is valid for the payload type.
- Candidate is outside current FOV unless the intervention is explicitly visible.
- Candidate preserves level reachability and does not block required routes.
- Candidate uses integer grid coordinates and tolerates negative world coords.
- Candidate respects existing trap, item, actor, shrine, and terrain occupancy.
- Candidate has a plausible path to affect the player within a short horizon.

For monsters, prefer canonical spawn/materialization helpers. For loot, prefer
`materializeDrop` or the relevant loot resolver path. For traps, use the trap
script/archetype path that ordinary dungeon generation uses.

## Budgets And Cooldowns

The deity needs limits so it feels like a hidden mind, not a spammer.

Suggested budgets:

- Pressure budget: rises during boredom, falls after damage or combat intensity.
- Relief budget: rises during overpressure, falls after useful aid.
- Temptation budget: rises when the player is stable and exploring.
- Wrath budget: rises from deity offense and prayer abuse.
- Miracle budget: rises from favor, shrine play, sacrifice, and restraint.

Suggested cooldowns:

- Emergency potion: long cooldown, one active rescue route at a time.
- Behind-player monster: medium cooldown, suppressed after recent severe damage.
- Trap placement: medium cooldown, suppressed in already trap-dense areas.
- Wisp hint: short cooldown, but repeated hints should decay in directness.
- Direct miracle/wrath: long cooldown unless deity mood is extreme.

## Spirit Guide Presentation

The guide should not openly confess the system too early. Its behavior can imply
agency before the reveal.

Presentation modes:

- Tutorial: direct helpful tips for first-time onboarding.
- Omen: indirect warnings, pulses, color shifts, hesitation before danger.
- Companion: points to relief or temptation, sometimes with selective honesty.
- Judge: reacts to divine standing, offerings, cruelty, greed, restraint.
- Architect: late-game or rare moments where it becomes clear the guide has been
  arranging events.

Potential lines should be short and ambiguous:

- "This way. Quickly."
- "You will need what waits ahead."
- "Do not ask how I knew."
- "A little fear sharpens the soul."
- "I did not place the trap. I merely allowed it."

The display layer should remain a consumer of events such as
`deity:intervention`, `guidance:pulse`, and future `deity:omen` events.

## Debugging

This feature needs strong inspection tools because invisible authorship is hard
to reason about.

Useful debug output:

- Current pressure, relief, temptation, wrath, miracle budgets.
- Last N interventions with reason, target, payload, and materialization result.
- Placement rejection counts by reason: visible, blocked, unreachable, occupied.
- Whether the player could have known about the target tile.
- Active cooldowns.
- Deity mood and standing snapshot at proposal time.

The existing deity debug graph is a natural display surface, but the rules data
should also be inspectable through tests and command-line audit tools.

## Testing

The most important tests are invariants.

Required coverage for implementation:

- Same seed and same inputs produce the same intervention sequence.
- No ordinary intervention materializes inside current FOV.
- Emergency relief does not appear when the player already has adequate relief.
- Pressure is suppressed after recent severe damage unless wrath overrides it.
- Placement never breaks stairs reachability.
- Monster interventions use canonical spawn paths.
- Loot interventions use canonical materialization paths.
- Trap interventions use canonical trap paths.
- Deity intervention entities expire and clean up.

Avoid snapshot tests that lock exact tile choices unless the placement algorithm
is intentionally part of the contract.

## Follow-up: Total Divine Authorship

There is a stronger version of this idea: the deity eventually directs
all traps, all monsters, all loot, all miracles, and all major dungeon pressure.

That is possible, but the important distinction is total authorship, not total
micromanagement.

Bad version:

- Every monster spawn asks bespoke deity code what exact monster to create.
- Every trap, chest, potion, shrine, spawner, and miracle gets special branches.
- Dungeon generation becomes a live difficulty script with hidden ad hoc rules.
- Existing loot tables, monster pools, trap tables, and materializers are
  bypassed.

Good version:

- All content producers continue using canonical generation and materialization
  paths.
- The deity owns policy: budgets, weights, vetoes, pacing, and intent.
- Existing tables still own domain content: which monsters exist, which loot can
  drop, which traps are valid at depth, which miracles a deity can express.
- Initial floor population and live offscreen interventions both pass through
  the same deity-facing request shape.
- Content can still be precomputed, but it is precomputed from a divine policy
  instead of only from neutral dungeon density rules.

The deity should become the answer to "why did this exist here?" without
becoming the implementation of every thing that exists.

### Deity As Policy Layer

The long-term architecture can treat all content placement as requests:

```js
{
  kind: "monster" | "trap" | "loot" | "feature" | "miracle",
  phase: "floor_populate" | "offscreen_live" | "visible_divine",
  depth,
  roomId,
  playerState,
  deityState,
  candidates,
  constraints,
}
```

The deity returns a decision:

```js
{
  allow: true,
  intent: "pressure" | "relief" | "temptation" | "lesson" | "wrath",
  weightBias: { monster: 1.2, trap: 0.8, healing: 0.4 },
  selectedCandidate,
  reason: "boredom",
}
```

This lets generation ask the deity for policy without making the deity know how
to construct a goblin, a potion, a pit trap, or a shrine.

### Initial Generation Versus Live Direction

Total authorship should have two modes.

Initial generation:

- The deity biases room themes, trap density, monster pressure, and loot shape.
- The level is still fully deterministic from seed plus deity/player state.
- The player can inspect the result later and it remains coherent.
- Most content feels like it was always there.

Live offscreen direction:

- The deity reacts to the run after the floor begins.
- Only tiles outside reliable player knowledge can receive ordinary changes.
- Live changes are represented as `DeityIntervention` entities.
- Materialization still uses canonical paths.

Visible divine direction:

- Miracles, wrath, curses, omens, and hallucinations can break ordinary
  offscreen law because the fiction tells the player reality is being acted on.
- These should be rarer, logged, and attributable to the deity.

### Migration Path

This should not start by rewriting the dungeon generator. A practical follow-up
is to build a deity policy adapter around existing placement decisions.

Suggested progression:

1. Add read-only instrumentation that labels existing generated monsters, traps,
   loot, and miracles with inferred intent: pressure, relief, temptation,
   lesson, neutral.
2. Add a policy hook that can veto or reweight one narrow category, such as
   healing potion placement.
3. Expand to monster pressure budgets while still using existing monster pools.
4. Expand to trap budgets and trap/loot pairings.
5. Route miracle/wrath choices through the same policy vocabulary.
6. Only after those are stable, consider making floor population ask the deity
   for all high-level placement policy.

This keeps the system shippable at every step. The first useful version can say
"the deity caused this potion" long before the deity controls the entire dungeon.

## Implementation Slices

### Slice 1: Read-only Scoring

Add a rules-layer scoring helper that computes danger, boredom, relief need, and
divine pressure from existing state. Emit no gameplay changes. Add tests for
stable scoring.

### Slice 2: Intervention Entities

Create `DeityIntervention` child entities and a system that can enqueue and
expire them without materializing anything. Add debug/audit output.

### Slice 3: Relief Placement

Implement the safest intervention first: offscreen relief loot. Start with a
healing potion or food only when the player lacks that resource and is under
pressure. Use canonical materialization.

### Slice 4: Pressure Placement

Add offscreen monster pressure using canonical monster spawn helpers. Bias toward
weak or context-appropriate monsters until tuning is proven.

### Slice 5: Trap And Temptation

Add trap/loot pairings and route-based temptation. This requires stronger
placement validation because traps can invalidate routes or feel unfair.

### Slice 6: Spirit Guide Omen Layer

Let the wisp react to selected deity interventions: pulse, hesitate, point, or
say a short line. Keep this in display/main wiring as a consumer of rule events.

## Open Questions

- Should the player eventually discover that the guide is arranging events, or
  should it remain subtext?
- Should different deities optimize different flavors of fun: mercy, cruelty,
  chaos, sacrifice, mastery, greed?
- Does authorship belong to the active patron, the pantheon, or the dungeon
  itself when pantheon mode is enabled?
- How much should the deity remember across floors?
- Can high player favor request a specific kind of intervention, or only bias the
  deity's hidden choice?
- Should death records include "divine authorship" when an intervention helped
  create the fatal situation?

## Design Thesis

The best version of this system does not make the dungeon feel fake. It makes the
player slowly suspect that the dungeon has intent.

The spirit guide is the face of that intent. Sometimes it saves the player.
Sometimes it endangers them. Most of the time it does both, because the deity is
not trying to produce safety. It is trying to produce a memorable run.
