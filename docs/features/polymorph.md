# Polymorph

Current implementation notes for the polymorph feature. This memo captures the architecture and design decisions as of the first polymorph-control pass.

## Intent

Polymorph is meant to be a high-variance transformation mechanic:

- without control, it is a gamble;
- with control, it becomes a powerful crowd-control and utility tool;
- target identity, target resistance, actor control, and repeated attempts should all matter.

The implementation should support future cases such as self-polymorph, shopkeeper polymorph, villager polymorph, pets, summons, quest NPCs, and backlash effects without forking the transformation path.

## Canonical Split

The system is split into policy and resolution:

- Policy decides whether an attempt succeeds and what final form should be used.
- `resolvePolymorph()` remains the canonical mutation path that replaces the entity.

Important files:

- `src/rules/utils/polymorphPolicy.js`
- `src/rules/systems/polymorphSystem.js`
- `src/rules/components/PolymorphProfile.js`
- `src/rules/components/PolymorphExposure.js`
- `src/main/wiring/scrollWandWiring.js`
- `src/main/monsters/monsterChoices.js`
- `src/display/ui/monsterChooserOverlay.js`

## Control

Polymorph control is resolved through `getPolymorphControl(world, actorId)`.

Current control sources:

- `Traits.polymorph_control`
- passive bonus `polymorphControl`

`Ring of Polymorph Control` is ordinary ring content. It grants:

```js
bonuses: { polymorphControl: 1 }
```

The scroll wiring no longer reads traits directly. It asks policy whether the actor has control, then opens the generic monster chooser if control is present.

## Monster Chooser

Polymorph control and genocide now share a generic monster chooser UI.

Display receives DTOs only. Main/rules-facing code builds the candidate list. This keeps display from importing rules data and lets future legality policy disable or annotate candidates without replacing the UI.

## Resistance

Polymorph resistance is resolved through `getPolymorphResistance(world, targetId)`.

It composes:

- runtime `PolymorphProfile`, if present;
- monster authoring data, via `NamedIdentity -> getMonster()`;
- passive bonuses such as `polymorphResistance` and `polymorphStability`;
- short-term `PolymorphExposure` from repeated failed or partial attempts.

This makes polymorph resistance player-facing as well as monster-facing.

## Authoring Surface

Monster content can use:

```js
polymorphResistance: 0.65,
polymorphStability: "anchored",
```

`polymorphResistance` is a `0.0..1.0` chance to reject a polymorph attempt before transformation, before control/power modifiers.

`polymorphStability` is a serialized enum, not a bare number:

- `"unstable"`: malleable or incoherent form
- `"ordinary"`: ordinary living body
- `"anchored"`: supernatural, ancient, stone-like, or constructed form
- `"fixed"`: exceptional plot, boss, warded, or otherwise deeply coherent form

Numeric legacy values normalize for compatibility, but new content should use the string enum.

Runtime-special entities can use `PolymorphProfile`:

```js
world.add(entityId, PolymorphProfile, {
  resistance: 0.8,
  stability: "anchored",
});
```

This is the expected path for shopkeepers, villagers, quest NPCs, and future player-facing temporary states.

## Failure Behavior

Failure behavior is derived from stability, not from a separate failure-mode axis:

- `unstable`: uncontrolled failures can be volatile; controlled failures can fumble into a wrong valid form.
- `ordinary`: controlled failures can fumble; otherwise normal resistance.
- `anchored` and `fixed`: clean resistance.

The project explicitly removed the extra `polymorphFailureMode` axis because it created an unclear NxM matrix with stability.

Future backlash should be a separate effect payload surface, not a failure classifier. See `docs/todo/polymorph-backlash-surface.md`.

## Repeated Attempts

`PolymorphExposure` records failed or partial attempts on a surviving target.

Repeated attempts increase a short-term `resistanceBonus`, capped at `0.5`. This prevents brute-force repeat casting from being the obvious answer against resistant bodies.

The exposure state is scalar runtime state, not an array of attempts.

## Current Authored Examples

Examples using the authoring surface:

- `dragon`: high resistance, anchored form
- `stone_taunter`: very high resistance, anchored construct form
- `cockatrice`: stone-adjacent resistance, anchored form
- `floating_eye`: psychic body, ordinary stability, can fumble controlled failures
- `mimic`: unstable false-shape body, can fumble controlled failures
- `gelatinous_cube`: unstable ooze, can produce volatile no-transform failures

## Open Follow-Ups

- Self-polymorph policy, likely using `ignoreTargetResistance` for intentional self-transform.
- Shopkeeper, villager, quest NPC, pet, and summon policy.
- What survives transformation: faction, ownership, debt, aggro, memory, statuses, equipment, quest identity.
- Polymorph backlash payloads: psychic, toxic, arcane, summon, script, deity, shop/legal.
- More player-facing polymorph resistance sources: gear, class features, traits, temporary statuses.
- Stronger legality policy for target classes and candidate chooser annotations.
- Broader audit of authored numeric ratings. See `docs/todo/authored-rating-enums.md`.

