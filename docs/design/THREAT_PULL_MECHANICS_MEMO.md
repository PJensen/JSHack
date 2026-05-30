# Threat, Pull, and Pet Tanking Memo

Date: 2026-05-30
Status: Planning memo

This memo captures the intended direction for precise threat mechanics, pull behavior,
taunts, target shifts, and pet tanking. It is not a description of fully implemented
runtime behavior yet.

## Goal

Threat should make combat relationships legible and actionable:

- A player should understand when they have pulled aggro.
- A pet should be able to tank for the player through explicit mechanics.
- Taunts should visibly and mechanically snap or bias enemy attention.
- Threat should persist long enough to matter, then decay enough to allow resets.
- Visuals should communicate state changes without becoming a full MMO threat meter.

## Model Split

Do not overload `AggroState` into a full threat table. Keep it as the compact current
awareness and targeting summary, and move detailed per-source threat into runtime
child entities.

Recommended split:

- `AggroState`
  - `targetId`
  - `targetReason`
  - `highestThreatId`
  - `forcedTargetId`
  - `forcedUntilTurn`
  - `threatLockUntilTurn`
  - `lastTargetSwitchTurn`

- `ThreatEntry` child entity
  - owner/parent: enemy being influenced
  - `sourceId`: player, pet, summon, taunter, NPC
  - `value`: current threat
  - `lastTurnTouched`
  - `kind`: `damage`, `healing`, `taunt`, `proximity`, `body_block`, etc.
  - `forcedUntilTurn`
  - `decayRate`
  - `sticky`

This follows the runtime topology doctrine: active per-source runtime objects should
be child entities, not arrays inside `AggroState`.

## Pull Mechanics

Target switches should use stickiness rather than flipping whenever a source barely
exceeds the current target.

Initial pull rules:

- Current target keeps aggro unless challenger exceeds current target threat by:
  - `110%` if the challenger is in melee range.
  - `130%` if the challenger is ranged.
- Hard taunt overrides target for `N` turns.
- Soft taunt adds a burst of threat but does not override a hard lock.
- Guarding pets get a defensive threat multiplier when protecting their owner.
- Aggressive pets generate normal threat but should have less defensive stickiness.

## Threat Inputs

Start with a small useful set:

- Damage dealt: `threat += damage`.
- Taunt: force target for duration and set taunter threat to current top threat plus
  a margin.
- Pet protect/body-block: pet near owner and enemy targeting owner adds small
  recurring threat.
- Proximity: tiny threat when an alerted enemy has a creature closer than the player.
- Healing: later, likely `threat += healing * 0.5` if nearby and relevant.
- Noise/spells: later.

## Decay

Threat should be deterministic and easy to test. Prefer integer decay at first.

Candidate decay:

```js
targetThreat -= 1;
nonTargetThreat -= 2;
if (alertLevel !== "hunting") threat -= 3;
```

Rules:

- Active target threat decays slower than non-target threat.
- Threat entries at or below zero are removed.
- Forced taunt either does not decay while forced, or it decays but cannot lose
  target until `forcedUntilTurn`.
- If LOS is lost or the enemy downgrades from hunting, decay accelerates.

## Player And Pet Mechanics

The system should support these play patterns:

- Let pet tank: command pet to `guarding`, stand behind it, and let pet protect.
- Pull off pet: burst damage and exceed threat threshold.
- Taunt: pet, stone taunter, or future abilities force attention briefly.
- Threat drop: stealth, invisibility, blink, smoke bomb, or disengage reduces player threat.
- Threat transfer: future spell/item redirects part of player threat to a pet or summon.
- Overpull risk: ranged openings generate threat before the pet reaches the enemy.

## Visual Language

World visuals should show state and shifts, not numeric threat tables.

- Current target: subtle segmented ring on the enemy.
- Target is player: hotter segmented ring.
- Target is pet/ally: amber brackets on the pet/ally.
- Hard taunt active: brief snap tether plus compact locked ring segments.
- Threat unstable: ring flicker or alternating color when the player is near pull threshold.
- Threat drop: tether dissolves backward from enemy to source.
- Pet successfully tanks: enemy ring cools and pet brackets stabilize.

Avoid main-world numeric threat meters. Exact values belong in inspector/debug UI.

## Implementation Order

1. Add `ThreatEntry` child component/topology.
2. Add helpers:
   - `addThreat`
   - `forceThreatTarget`
   - `decayThreat`
   - `resolveThreatTarget`
3. Add `threatSystem`.
4. Feed damage and taunt into threat entries.
5. Replace direct `AggroState.targetId` changes with `resolveThreatTarget` where appropriate.
6. Add pet guarding/protect threat as recurring soft threat.
7. Bridge minimal display fields:
   - `targetReason`
   - `threatState`
   - `targetLocked`
8. Add regression tests:
   - damage pull
   - ranged pull threshold
   - taunt force
   - taunt expiry
   - pet protect
   - decay/reset

## First Slice

Keep the first implementation deliberately small:

- Damage threat.
- Taunt force.
- Integer decay.
- Pet protect.

This creates the core gameplay loop without attempting to reproduce every MMO
threat rule immediately.
