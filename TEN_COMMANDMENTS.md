# The Ten Commandments of JSHack

These exist because the same mistake was made **twice** (Oct 23 and Nov 6, 2025).
Both times the project was derailed by the same pattern: chasing elegant engine
work instead of building the game.

---

## I. Thou shalt not build a rendering engine.

JSHack is a **roguelike**. It uses a tile grid. Tiles are integers. Movement is
cardinal/diagonal on integer coordinates. There is no continuous space, no SDF
kernels, no analytic geometry. If you are writing `Math.hypot` for collision
detection, stop.

## II. Thou shalt not build a lighting engine.

No raycasting. No shadow volumes. No specular fields. No emissive light polygons.
No smooth glow renderers. FOV is a **boolean visibility mask** — each tile is
either visible, remembered, or unknown. Use simple shadowcasting (roguelike
standard) when the time comes. If a file has "kernel" in its name, delete it.

## III. Thou shalt keep positions as integers.

`Position.x` and `Position.y` are integers. `MoveIntent.dx` and `MoveIntent.dy`
are -1, 0, or 1. There is no `BoundingCircle`. There is no `strideDistance`.
There is no `distanceMove()`. Adjacency is Manhattan or Chebyshev distance === 1.

## IV. Thou shalt ship gameplay before graphics.

Every feature must answer: "what does the player **do** differently?" If the
answer is "nothing, but it looks better," it waits. Combat, items, spells,
monsters, dungeon layouts, progression — these come first. Visual polish is
a reward for finishing systems, not a substitute for them.

## V. Thou shalt write tests before systems.

If a system has no test, it doesn't exist. The Nov 1-4 rebuild succeeded because
it was test-driven. The Oct 23 and Nov 6 derailments had zero tests. Tests are
the guardrail that keeps you honest about what actually works.

## VI. Thou shalt recognize the commit message canary.

When commit messages degrade to single letters ("a", "a", "a"), you are in a
flow state solving the wrong problem. Stop. `git stash`. Walk away. Come back
and ask: "is this a game feature or an engine feature?" If it's engine, kill it.

## VII. Thou shalt not exceed one new system per session.

One ECS system per working session. Wire it, test it, commit it with a real
message. If you're adding 500+ lines across 25 files in one commit, you've
lost the plot. Small, tested, incremental.

## VIII. Thou shalt keep the rules layer pure.

`src/rules/` must never import from `src/display/` or reference rendering
concepts. Rules operate on integer grids, entity queries, and intent resolution.
If a rules-layer file needs a "geometry kernel," the architecture is wrong.

## IX. Thou shalt not solve problems the player cannot see.

Sub-tile collision resolution, capsule sweep tests, continuous-space pathfinding —
the player sees a grid. Solve grid problems. The elegance of the solution is
irrelevant if it solves a problem that doesn't exist in the game the player plays.

## X. Thou shalt drive systems with data, not code.

Monster behaviors, item effects, material reactions, status procs — these belong
in declarative definition files under `src/rules/data/`, not in `if/else` chains
inside systems. Systems read data and execute it; they do not *know* what "poison"
does. When adding a new effect or behavior, the first file you touch should be a
data definition, and it should have a schema validated at boot. If you're adding a
case to a switch statement, you're hard-coding.

## XI. Thou shalt remember: you did this twice.

Oct 23, 2025: 564 lines of lighting infrastructure in one evening. Deleted
12,924 lines six days later. Nov 6, 2025: 921-line GeometryKernel reintroduced
two days after the clean rebuild. Same mistake. Same rabbit hole. Different hat.

If you are excited about the math, **that is the warning sign.**
