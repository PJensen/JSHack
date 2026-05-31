# Missing ECS Tags Cleanup

## Problem

Some code paths query broad entity sets through `NamedIdentity` and then filter by string identity, even when the code is looking for a stable category such as stairs, shrines, altars, or fountains.

That is wasteful and weakens the ECS model. In ecs-js, a tag is a zero-data component and should be used for boolean category membership.

## Policy

Use tags for broad, stable categories queried by systems or shared runtime helpers.

Examples:

- `StairTag`
- `ShrineTag`
- `AltarTag`
- `SacredSiteTag`
- `FountainTag`
- `ShopkeeperTag`

Keep `NamedIdentity` for exact authored content IDs, display names, item IDs, monster species, and one-off content-specific checks.

## Namespace

Put tag components under:

```text
src/rules/components/tags/
```

Example:

```text
src/rules/components/tags/Stair.js
src/rules/components/tags/SacredSite.js
src/rules/components/tags/Fountain.js
```

Export tags from `src/rules/components/index.js` when they are used broadly.

## Migration Plan

1. Search for identity scans:
   - `world.query(Position, NamedIdentity)`
   - `world.query(NamedIdentity)`
   - loops that immediately compare `identity === "..."`

2. Classify each usage:
   - Category query: migrate to a tag.
   - Exact content lookup: keep `NamedIdentity`.
   - Test-only helper: migrate only if it obscures production intent.

3. Prioritize high-value runtime paths:
   - stair traversal and transition
   - quest placement near stairs
   - shrine/altar proximity checks
   - fountain systems
   - shop/town service lookups if they run frequently
   - debug/UI helpers last

4. Attach tags in canonical archetypes, not scattered spawn code.

5. Add focused tests that canonical archetypes carry their tags.

6. Add an architecture guard once the common tags exist:
   flag new `world.query(Position, NamedIdentity)` scans in rules when they compare against known tagged categories.

## First Target

Collapse stair direction into one tag:

```js
export const StairTag = defineTag("Stair");
```

`StairDown` and `StairUp` should both carry `StairTag`. Direction remains encoded by existing interaction/identity data, because a stair is the same category regardless of travel direction.
