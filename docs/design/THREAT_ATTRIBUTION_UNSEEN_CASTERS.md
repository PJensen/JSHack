# Threat Attribution For Unseen Casters

Date: 2026-05-31
Status: Planning memo

This memo captures the next design layer for threat attribution, sound, healing
threat, threat transfer, item tuning, debug inspection, and NPC policy overrides.
It extends the existing threat model in
[`THREAT_PULL_MECHANICS_MEMO.md`](THREAT_PULL_MECHANICS_MEMO.md) without changing
the core topology: detailed per-source threat remains `ThreatEntry` child
entities, while `AggroState` stays a compact targeting summary.

## Goal

Threat should answer two different questions:

- Who does this enemy want to attack right now?
- How confidently does this enemy know who caused the hostile event?

The first question is already the job of `ThreatEntry`, `AggroState`, and
`resolveThreatTarget`. The second question needs an attribution layer so unseen
casts, invisible attackers, noisy misses, healing, and NPC policy can produce
search or alert behavior without granting enemies perfect knowledge.

## Current Foundation

The runtime already has useful building blocks:

- `ThreatEntry` child entities store per-enemy, per-source threat.
- `threatSystem` listens to damage, taunt, threat drop, ranged miss, and selected
  spell events.
- Spell definitions can carry optional `threat` metadata, currently including
  `flatThreat`, `threatMult`, `threatKind`, target field selectors, and gating
  fields.
- Equipment threat modifiers already support tags and bonuses such as `subtle`,
  `silent`, `menacing`, `threat_boost`, `threatGenerationMult`,
  `threatMult`, and `threatReduction`.

The remaining work is mostly about attribution quality, radius/noise semantics,
and social/policy filtering above ordinary hostile targeting.

## Spell Threat Metadata

Spell definitions should remain the authoritative source for non-damage spell
threat. The desired metadata shape is:

```js
threat: {
  threatMult: 1,
  flatThreat: 3,
  threatKind: "spell_control",
  threatRadius: 6,
  threatAttribution: "source",
}
```

Recommended field semantics:

- `flatThreat`: fixed threat created by the spell effect.
- `threatMult`: multiplier applied to damage-derived or effect-derived threat.
- `threatKind`: semantic category such as `spell_control`, `spell_noise`,
  `spell_heal`, `spell_guard`, `spell_summon`, or `spell_terrain`.
- `threatRadius`: radius for nearby witnesses or hostiles affected by the event.
- `threatAttribution`: attribution policy, not only a source id.

Suggested `threatAttribution` values:

- `source`: affected enemies receive precise source threat if the source is
  attributable.
- `witnessed_source`: precise source threat only if the enemy or an ally witness
  can see, hear, or otherwise identify the caster.
- `location`: enemies become alert or search around the cast origin, but do not
  receive precise source threat.
- `none`: no tactical threat; useful for purely internal or harmless effects.

`threatSystem` should consume these fields through one helper instead of
hardcoding spell ids. Spell-specific listeners may still be needed to normalize
payload shapes, but the threat amount and attribution policy should come from
spell data.

## Attribution States

Threat events should classify attribution before creating source threat.

Recommended result states:

- `precise`: create or update `ThreatEntry` for the actor.
- `suspected`: create alert/search pressure around a last-known location, but do
  not assign full source threat.
- `noise`: create low curiosity or investigation behavior near a sound origin.
- `unattributed`: no tactical reaction, or only a very small local alert.

Important rule: invisibility, blocked LOS, darkness, and missing witnesses should
not automatically erase gameplay consequences. They should downgrade precise
source threat into search, suspicion, or noise when the event is still observable.

## Unseen Casters

Control spells are especially important because they can be hostile without
dealing damage. A blinded, entangled, silenced, feared, marked, or displaced enemy
should react, but not always with perfect source knowledge.

Recommended behavior:

- If the target sees the caster or has a valid witness path, apply precise threat.
- If the target cannot see the caster but can perceive the effect origin, create
  `suspected` attribution at that origin.
- If the spell is subtle and no witness can connect it to the caster, create no
  source threat and possibly a small local alert.
- If the spell is loud, flashy, explosive, or divine, nearby hostiles may receive
  noise/search attribution even when the target cannot identify the caster.

This requires a deterministic rules-layer attribution helper. It should consume
positions, FOV/perception state, faction relationships, spell metadata, and event
payload data. It must not import display code or rely on async observation.

## Ranged Noise

Missed arrows currently add tiny threat to the intended target. That is a useful
minimal behavior, but the richer model should split miss threat from noise.

Recommended behavior:

- Hit: damage threat through the canonical damage event.
- Clean miss with ordinary arrow: tiny target suspicion if the target notices the
  shot, plus optional low-radius noise.
- Silent ammo or muffled weapon: reduce or suppress miss noise, but not damage
  threat on a successful hit.
- Loud, cursed, bell, explosive, or gunpowder-like ammo: emit wider noise threat
  or alert/search pressure.
- Explosive misses should use the explosion event as the main attribution source,
  not the original ranged miss alone.

Weapon and ammo tags should drive this:

- `silent`: reduce or suppress noise attribution.
- `subtle`: reduce threat acquisition and witness confidence.
- `loud`: increase noise radius or alert severity.
- `explosive`: create area noise and likely precise attribution if witnessed.

Do not add full map scans for this. Use spatial-index radius queries around the
impact or miss location.

## Healing And Shielding Threat

Healing and protection should generate threat only when tactically relevant. A
hostile should care that its target was healed, shielded, or guarded; a monster
on the far side of the floor should not gain omniscient knowledge.

Recommended triggers:

- Direct heals.
- Regeneration bursts.
- Stoneskin or armor buffs.
- Shield guard and divine shield.
- Pet heals and owner-protect effects.

Recommended attribution rule:

- Find nearby hostiles already engaged with the healed or protected target.
- If they can attribute the support actor, add support threat to that actor.
- If they can see the target recover but not the support actor, create suspicion
  or search attribution rather than precise source threat.
- If the support source is the target itself, ordinary self-sustain threat can be
  lower than external healer threat.

Initial tuning can be conservative:

```txt
supportThreat = floor(restoredOrPreventedValue * 0.5)
```

Shielding needs a clear event payload carrying prevented value when possible.
Without a prevented-value event, use small flat `spell_guard` threat from spell
metadata.

## Threat Transfer Tools

Threat transfer is a strong pet-tanking mechanic and should be explicit rather
than hidden in pet AI.

Target gameplay:

- A player casts or uses a "Misdirect" effect on a pet or summon.
- For a few turns, some player-generated threat is copied or transferred to that
  ally.
- Enemies can still resist the transfer through policy, LOS, body blocking, or
  special intelligence.

Recommended runtime shape:

- Represent active transfer as a child entity or short-lived status attached to
  the source actor, not as an array inside `AggroState`.
- On threat generation, the threat listener checks active transfer state and
  reroutes a configured percentage.
- Existing entries can also be partially moved at cast time by reducing the
  player entry and adding to the pet/summon entry.

Suggested event:

```js
world.emit("threat:transfer", {
  sourceId,
  recipientId,
  percent: 0.5,
  turns: 5,
  reason: "misdirect",
});
```

The transfer should preserve determinism and source identity. It should not make
the pet responsible for crimes, social memory, debt, or non-combat reputation.

## Tank Gear And Rogue Gear

Threat tuning belongs in item tags and bonuses, not in item-name branches.

Recommended tags and bonuses:

- `menacing`: increases generated threat.
- `threat_boost`: explicit item tag for threat increase.
- `threatGenerationMult`: numeric multiplier for generated threat.
- `subtle`: reduces generated threat and may reduce attribution confidence.
- `silent`: reduces miss/noise attribution and may reduce generated threat.
- `threatReduction`: numeric reduction applied to generated threat.

Good item fits:

- Shields, bells, war banners, cursed noisy armor: `menacing`,
  `threat_boost`, or high `threatGenerationMult`.
- Assassin gear, muffled boots, shadow cloaks: `subtle`, `silent`, or
  `threatReduction`.
- Pet tank collars or guardian sigils: threat boost while guarding, ideally via
  a conditional passive or status rather than a permanent global multiplier.

Keep damage, noise, and attribution separate. A silent dagger can still create
precise threat if the enemy sees the stab.

## Threat Inspector

Main-world visuals should stay minimal. Exact tuning data belongs in debug UI.

The inspector should show per-enemy threat entries:

- Enemy id and name.
- Current `AggroState.targetId`, reason, alert level, and `threatState`.
- Each `ThreatEntry`: source id/name, value, kind, sticky flag,
  `forcedUntilTurn`, decay rate, and last touched turn.
- Attribution state for recent events when available: `precise`, `suspected`,
  `noise`, or `unattributed`.
- Policy overrides if an NPC is ignoring or delaying normal threat resolution.

This should be read-only debug presentation over rules state. Display/debug code
may read a bridge/debug DTO, but it should not mutate tags or threat entries.

## NPC Policy Layer

Hostile NPCs should use the same threat topology, but guards, shopkeepers, and
civilians need policy above threat.

Threat answers who is tactically attractive. Policy answers what the NPC is
allowed or obligated to do.

Examples:

- Guards defend civilians or hold an exit even when a pet has higher threat.
- Shopkeepers defend stock, block shop exits, or pursue debt claims.
- Civilians may flee instead of attacking their highest threat source.
- Law-bound NPCs may ignore pet taunts briefly unless physically blocked.
- Intelligent enemies may downgrade obvious misdirection from pets or summons if
  they can still reach the real offender.

Policy should not change the `ThreatEntry` shape. It should sit between threat
resolution and action selection, returning a target override, duty objective, or
reason to ignore ordinary threat for a short deterministic window.

## Implementation Order

1. Extend spell threat metadata support for `threatRadius` and
   `threatAttribution`.
2. Add a deterministic attribution helper that returns `precise`, `suspected`,
   `noise`, or `unattributed`.
3. Route control spell threat through spell metadata plus attribution instead of
   event-name assumptions.
4. Split ranged miss handling into target suspicion and local noise.
5. Add support-threat events for healing, shielding, regen, and guard prevention.
6. Add threat transfer runtime state and `threat:transfer` event handling.
7. Expand item data with threat tags and bonuses.
8. Add the debug threat inspector DTO/view.
9. Add NPC policy overrides for guards, shopkeepers, and civilians.

## Test Strategy

Prefer invariant tests over exact scene snapshots:

- An unseen control spell creates search/suspicion, not precise source threat.
- A witnessed control spell creates precise source threat from spell metadata.
- Silent ranged misses generate less or no noise compared with loud misses.
- Healing a target engaged by a hostile creates support threat only for relevant
  nearby hostiles.
- Threat transfer moves or redirects combat threat without changing shop debt or
  social memory.
- Guard/shopkeeper policy can override target choice without deleting underlying
  threat entries.

