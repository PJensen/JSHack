# Runtime Topology Work Items

This backlog breaks [RUNTIME_TOPOLOGY_DOCTRINE.md](RUNTIME_TOPOLOGY_DOCTRINE.md)
into incremental work. Each item should be small enough to land with focused
tests and without broad system rewrites.

Status key:

- `Ready`: can be started with current architecture.
- `Blocked`: needs an earlier work item first.
- `Migration`: changes canonical runtime state while preserving compatibility.

## 1. Canonize Topology Traversal Helpers

Status: `Done`

Goal: provide one shared way to traverse child and descendant topology by
component.

Scope:

- Add `src/rules/utils/topology.js`.
- Export `childrenWith(world, parent, Component)`.
- Export `firstChildWith(world, parent, Component)`.
- Export `descendantsWith(world, parent, Component)`.
- Use ecs-js hierarchy primitives; do not modify ecs-js.

Acceptance criteria:

- Helpers skip missing parents and missing components safely.
- Helper order follows ECS child order.
- Tests cover direct children, descendants, missing components, and empty trees.

Suggested test:

- `tests/topologyHelpers.test.mjs`

## 2. Add Runtime State Node Components

Status: `Done`

Goal: introduce the small flat components needed by later migrations without
changing behavior yet.

Scope:

- Add `StatusEffectNode`.
- Add `TimedEffectNode`.
- Add `Duration`.
- Add `Source`.
- Add `Charges`.
- Export all new components from `src/rules/components/index.js`.

Acceptance criteria:

- Components are flat records or tags.
- Component names and fields are documented in file comments.
- No existing runtime behavior changes.
- Component export smoke test passes.

Suggested test:

- `tests/runtimeTopologyComponents.test.mjs`

## 3. Document Legacy Runtime Arrays In Code

Status: `Done`

Goal: mark known legacy array-backed runtime state so future edits do not treat
it as precedent.

Scope:

- Add concise comments to legacy components or utilities that own runtime arrays.
- Start with `ActiveEffects.effects[]`.
- Add comments near item-info affix, socket, coating, and charge mutation helpers
  when touching those files for topology work.

Acceptance criteria:

- Comments point to `RUNTIME_TOPOLOGY_DOCTRINE.md`.
- Comments say compatibility state, not canonical topology.
- No runtime behavior changes.

Suggested verification:

- Docs/code review only.

## 4. Create Status Topology Resolver

Status: `Done`

Goal: provide one read facade that can see both legacy `ActiveEffects.effects[]`
and new status child entities.

Scope:

- Extend or replace `src/rules/utils/statusFacade.js` with topology-aware reads.
- Return a stable status view for callers.
- Preserve existing `ActiveEffects.effects[]` behavior.
- Prefer child `StatusEffectNode` / `TimedEffectNode` data when present.

Acceptance criteria:

- Existing status facade tests still pass.
- New tests cover legacy-only, topology-only, and mixed status state.
- Mixed state has deterministic ordering.
- No direct callers need to crawl status children manually.

Suggested test:

- Extend `tests/statusFacade.test.mjs`.

## 5. Add Canonical Status Effect Creation Helper

Status: `Done`

Goal: create status effects through one canonical helper that can emit topology
while maintaining legacy compatibility.

Scope:

- Add a helper such as `applyStatusEffect(world, actorId, effectDef)`.
- Helper creates a child status/timed-effect entity.
- Helper mirrors to `ActiveEffects.effects[]` only where compatibility still
  requires it.
- Existing ad hoc effect pushes should migrate gradually to this helper.

Acceptance criteria:

- One migrated effect family has parity between old and new views.
- Cancellation or action transactions still do not leak partial effects.
- Tests prove the resolver sees the applied effect.

Suggested tests:

- Extend `tests/actionTransaction.test.mjs` if transaction integration changes.
- Add a focused status application parity test.

## 6. Migrate One Status Family To Topology

Status: `Done`

Goal: prove the status migration path with one small status family.

Recommended first candidates:

- `invulnerable`, because it is simple and already used as a defensive flag.
- Or `poison`, because it exercises ticking and visible gameplay.

Scope:

- Route new applications of the chosen status through the canonical helper.
- Keep old array compatibility until all direct callers are migrated.
- Update status tick/removal logic only as much as needed for the chosen family.

Acceptance criteria:

- Existing tests for the chosen status still pass.
- New topology-specific test proves a child status node exists.
- Resolver output matches legacy view for gameplay-relevant fields.
- No unrelated status families are rewritten.

## 7. Create Charges Resolver

Status: `Done`

Goal: stop charge-aware logic from reading only item-info fields.

Scope:

- Add a resolver such as `resolveCharges(world, ownerId)` or domain-specific
  helpers for socket/item charges.
- Resolver reads `Charges` components on attached runtime nodes.
- Resolver may fall back to legacy item-info charge fields.

Acceptance criteria:

- Reads topology charges first.
- Legacy charge reads remain supported.
- Tests cover topology-only, legacy-only, and mixed state.

Suggested test:

- `tests/chargesResolver.test.mjs`

## 8. Move Gem Socket Charges To Runtime Nodes

Status: `Done`

Goal: make socket charge state live on socketed child entities instead of only
inside item info.

Scope:

- Add or canonize `SocketNode` and `SocketedItemNode` if existing
  `GemSocketNode` is not enough.
- Attach socket and socketed item runtime children under the weapon.
- Store charges on the socketed runtime child with `Charges`.
- Keep existing item-info fields as compatibility mirrors during migration.

Acceptance criteria:

- Shrine/recharge logic can update `Charges` on the runtime node.
- Existing gem socket proc tests still pass.
- New test proves socketed runtime child owns charges.
- Save/load implications are documented or covered if touched.

Suggested tests:

- Extend gem socket tests around `src/rules/data/gemSocketAffixes.js`.
- Add a focused socket-charge topology test.

## 9. Create Enchantment Runtime Node Path

Status: `Done`

Goal: let scrolls, shrines, oils, curses, and similar effects create runtime
enchantment children rather than only mutating affix arrays.

Scope:

- Add `EnchantmentNode`.
- Add a canonical helper such as `attachEnchantmentNode(world, itemId, def, ctx)`.
- Attach proc packages, gates, effects, `Source`, and optional `Charges` under
  the enchantment node.
- Leave authored/default affix arrays as definition or import data.

Acceptance criteria:

- Helper creates a visible child subtree.
- Helper delegates to existing proc topology authoring where possible.
- One enchantment-like path uses the helper behind compatibility mirrors.
- Parity test compares proc behavior before and after migration for that path.

Suggested test:

- `tests/enchantmentTopology.test.mjs`

## 10. Migrate Scroll-To-Affix Enchanting

Status: `Done`

Goal: make enchanting runtime output topology-backed.

Scope:

- Identify the scroll or item hook path that applies affixes/enchantments.
- Route one scroll/enchantment through `attachEnchantmentNode`.
- Preserve display names and existing gameplay behavior.
- Do not migrate every scroll in one change.

Acceptance criteria:

- Enchanted item has an `EnchantmentNode` child.
- Existing affix/proc behavior still fires.
- Compatibility view continues to show the enchantment where UI needs it.
- Tests cover creation and behavior parity.

## 11. Create Equipment Topology View

Status: `Blocked` by item 1

Goal: define the read model for equipment slots before changing canonical state.

Scope:

- Add `EquipmentRoot` and `EquippedSlotNode`, or document why an existing
  component covers the same role.
- Add `resolveEquipmentView(world, actorId)`.
- Resolver reads child slot topology when present.
- Resolver falls back to the legacy `Equipment` component.

Acceptance criteria:

- Existing equipment behavior does not change.
- Tests cover legacy-only, topology-only, and mixed state.
- Resolver output is stable enough for UI and stat derivation.

Suggested test:

- `tests/equipmentTopologyView.test.mjs`

## 12. Migrate One Equipment Slot

Status: `Migration`, blocked by item 11

Goal: prove equipment topology with one slot while keeping legacy quick lookups.

Recommended first candidate:

- Main hand, because weapon procs, sockets, coatings, and enchantments all care
  about it.

Scope:

- Equip main-hand items through slot child topology.
- Keep `Equipment.weapon` as a derived/cache value during migration.
- Route stat and proc resolution through `resolveEquipmentView` where touched.

Acceptance criteria:

- Equipping and unequipping main hand creates/removes or reparents slot topology.
- Legacy `Equipment.weapon` remains correct.
- Weapon proc and socket tests still pass.
- New test proves topology and legacy cache stay in parity.

## 13. Retire One Legacy Mirror

Status: `Migration`, blocked by at least one successful domain migration

Goal: remove one compatibility mirror once no runtime path needs it as source of
truth.

Scope:

- Pick the smallest fully migrated field or array.
- Update all callers to use the resolver/facade.
- Keep import/save migration if persisted data still contains the old shape.

Acceptance criteria:

- No runtime system reads the retired field as source of truth.
- Existing saves or fixtures migrate if relevant.
- Regression test protects against reintroducing the field as canonical runtime
  state.

## 14. Add Runtime Topology Boundary Test

Status: `Ready`

Goal: make topology doctrine mechanically visible without over-policing legacy
systems.

Scope:

- Add a test or script that scans new topology component exports and helper
  usage.
- Keep it advisory for known legacy arrays.
- Fail only on explicit banned new component names or new direct helpers if the
  project decides to enforce them.

Acceptance criteria:

- Test documents known legacy exceptions.
- Test is cheap to run under Deno.
- Test does not require a build step or external dependency.

Suggested test:

- `tests/runtimeTopologyDoctrine.test.mjs`

## Preferred Order

1. Topology traversal helpers
2. Runtime state node components
3. Legacy comments
4. Status resolver
5. Status creation helper
6. One status migration
7. Charges resolver
8. Gem socket charges migration
9. Enchantment runtime node path
10. One scroll-to-enchantment migration
11. Equipment topology view
12. One equipment slot migration
13. Retire one legacy mirror
14. Boundary test

This order builds shared primitives first, proves one narrow migration at a
time, and avoids turning the doctrine into a broad rewrite.
