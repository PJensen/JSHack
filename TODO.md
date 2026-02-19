# TODO (Friday, February 20, 2026)

## Data-Space Behavior Porting (Hook-Native)

1. Port high-impact consumables to item-def hooks (`on_drink`, `on_throw`, `on_dip`) first.
2. Port only behaviors that create meaningful player-facing outcomes; skip low-value legacy edge behavior for now.
3. Move shared effect logic into `ctx.helpers`-driven helper calls instead of bespoke script branches.

## Runtime + Registry Convergence

1. Unify UI targeting resolvers with hook registries so UI and runtime use one source of truth.
2. Continue retiring legacy def lookups (`*_DEFS`) in favor of payload/hook registries.
3. Add/expand validators for hook registries and hook function shapes.

## Determinism + Boundaries

1. Remove remaining `Math.random()` usage in rules paths being migrated.
2. Replace remaining raw world escape-hatch usage in payload paths with explicit facets/helpers.
3. Add guard tests to prevent pipelines from importing legacy apply/use def adapters.

## “Good Enough” Done Criteria For This Slice

1. Newly migrated items are fully playable via hook-native pipelines.
2. No direct world mutation from payload hooks in migrated files.
3. Tests cover success, cancel/discard, and deterministic replay for migrated behaviors.
