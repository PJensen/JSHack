Conventions for systems

- One file, one system (or small related helpers).
- Systems export a default function `system(world)` or a named `createSystem(world, opts)`.
- Systems are pure functions that operate on the `world` interface exported by `src/ecs/core.js`.
- Prefer simple, small systems: MovementSystem, AISystem, RenderSystem, CombatSystem, PickupSystem.
- Systems should not import DOM directly; `RenderSystem` may accept a canvas/context via options.
