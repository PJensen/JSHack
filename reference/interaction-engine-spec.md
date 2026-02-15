# Interaction Engine Specification (JSHack, Rules Layer) v0.1

## 1. Purpose
Define a deterministic, event-driven interaction model for high-density roguelike behavior (combat, item use, status, material reactions) without modifying `src/lib/ecs-js`.

## 2. Scope
- Applies only to `src/rules/**`.
- Uses ECS entity IDs and components, not mutable OO entities.
- Replaces ad-hoc cross-system logic with explicit interaction pipelines.

## 3. Non-Goals
- No changes to `src/lib/ecs-js/**` unless fixing a proven ECS bug.
- No rules-to-display coupling.
- No async/timers/promises in rules.

## 4. Core Invariants
- Determinism: same seed + same inputs + same tick order => identical outcome.
- Single commit point per interaction.
- Handlers request changes; pipeline commits changes.
- `ctx.cancel()` must prevent all state commit for that interaction.
- Systems never call other systems directly; communication via events.
- Listener installers must be Symbol-guarded.

## 5. Dispatcher Contract
```ts
type Priority = number; // lower runs earlier, default 100

interface InteractionDispatcher {
  on(event: string, handler: (ctx: InteractionContext) => void, priority?: Priority): number;
  off(listenerId: number): boolean;
  emit(event: string, ctx: InteractionContext): InteractionContext;
}
```

Rules:
- Stable order: `priority ASC`, then `registrationId ASC`.
- No randomness inside dispatcher internals.
- Handler exceptions are caught and emitted as `interaction:error`; interaction continues unless policy says cancel.

## 6. Context Contract
```ts
interface InteractionContext {
  world: World;
  rng: () => number;
  turn: number;
  step: number;
  type: "attack" | "use" | "consume" | "death" | "tile";
  event: string;

  cancelled: boolean;
  prevented: Set<string>;
  reason?: string;

  mods: Record<string, number[]>;
  log: Array<{ turn:number; msg:string }>;

  tx: MutationRequestQueue;

  cancel(reason?: string): void;
  prevent(flag: string): void;
  modify(key: string, value: number): void;
  sumMod(key: string, base?: number): number;
  multMod(key: string, base?: number): number;
  note(msg: string): void;
}
```

Rules:
- Contexts contain IDs and plain data only.
- No direct component writes from handlers.
- All mutations are queued via `tx`.

## 7. Mutation Request Queue
```ts
interface MutationRequestQueue {
  requestDamage(entityId:number, amount:number, damageType:string, source:any): void;
  requestHeal(entityId:number, amount:number, source:any): void;
  requestStatusAdd(entityId:number, key:string, spec:any): void;
  requestStatusRemove(entityId:number, key:string): void;
  requestChargeDelta(itemId:number, delta:number): void; // consume = +1
  requestDurabilityDelta(itemId:number, delta:number): void;
  requestSpawn(defId:string, x:number, y:number, params?:any): void;
  requestDestroy(entityId:number): void;
}
```

Rules:
- Requests are append-only during resolve.
- Commit applies requests exactly once in deterministic order.
- Deterministic order is by operation class then ascending entity/item ID then request index.
- Direct mutation of `ItemInfo`, `Vitality`, `Status`, etc. inside handlers is forbidden.

## 8. Cancellation and Prevention Semantics
- `ctx.cancel(reason)`:
  - Stops dispatcher propagation immediately.
  - Skips commit phase entirely.
  - Guarantees no charge/durability/HP/status/drops are applied.
- `ctx.prevent(flag)`:
  - Does not stop propagation.
  - Sets a soft veto flag checked by pipeline logic.
  - Example: `prevent("consume:item")` can block item consumption while still allowing side messages.

## 9. Pipeline Model
Each interaction pipeline must use this sequence:
1. `before`
2. `resolve`
3. `apply-guards`
4. `commit`
5. `after`

Required behavior:
- `before` and `resolve` may enqueue requests and mods.
- `apply-guards` reads `cancelled` and `prevented`.
- `commit` is a single function call.
- `after` emits informational events only.

## 10. Use-Item Contract (charge correctness)
- Charge consumption is represented only via `tx.requestChargeDelta(itemId, +1)`.
- Item effects never decrement charges directly.
- If `ctx.cancel()` occurs before commit, no charge is consumed.
- If multiple handlers request charge consume, pipeline must define policy:
  - v0.1 default: clamp to max `+1` per use action unless explicitly marked multi-charge.

## 11. RNG Contract
- All probabilistic decisions use seeded deterministic RNG from context.
- No `Math.random()` in rules interaction code.
- Proc rolls must include stable salt inputs (`world.seed`, `world.step`, actor/target IDs, proc salt).

## 12. Data Definition Contract
Proc and item behavior data must be declarative:
```ts
interface ProcDef {
  id: string;
  trigger: string;
  chancePct: number;
  seedSalt: number;
  conditions?: Array<string>;
  effects?: Array<EffectOp>;
}
```

Rules:
- Data should prefer effect op IDs + params over inline lambdas.
- Inline functions allowed only when necessary and covered by tests.
- IDs must be stable and unique.

## 13. Effect Operation Contract
Effects are pure request builders:
```ts
type EffectOp = (ctx: InteractionContext, params?:any) => void;
```

Rules:
- Effect ops enqueue via `ctx.tx`.
- Effect ops may add logs/modifiers.
- Effect ops must not query display or DOM.
- Effect ops must be unit-tested independently.

## 14. Installer Contract
Listener installation functions must use:
- `Symbol.for('jshack:<domain>:<what>:installed')`
- Guard re-installation.
- Be called from `configureWorld()` in `src/main/scheduler.js`.

## 15. Test Requirements (mandatory)
For each new pipeline or trigger family:
- Determinism replay test.
- `cancel()` prevents commit test.
- `prevent()` soft-flag behavior test.
- Single-commit charge test (no double consume).
- Stable listener ordering test.
- Regression test for one representative combinatorial interaction.

## 16. Recommended Module Layout
- `src/rules/interaction/dispatcher.js`
- `src/rules/interaction/context.js`
- `src/rules/interaction/mutations.js`
- `src/rules/interaction/commit.js`
- `src/rules/interaction/effects.js`
- `src/rules/interaction/events.js`
