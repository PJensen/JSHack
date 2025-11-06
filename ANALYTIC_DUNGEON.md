Based on the following specification:

```md
Analytic Carve-World Dungeon System — Final Technical Spec
0) World Frame & Boundary Conditions

Space: Continuous 2D Euclidean plane (right-handed).

Origin: (0,0) canonical reference; +X east, +Y south. Angles CCW from +X.

Units: World units (renderer decides pixel scale).

Boundary: The plane is solid rock by default. Only explicit carve operations create free space.

Implication: No map bounds required; all queries are defined globally. Rendering and culling use an independently computed MBR (below).

1) Core Model

Start with solid stock Ω.

Free space F is the complement of subtractive tool sweeps:

F = Ω \ ⋃ᵢ Sweep(Bitᵢ along Pathᵢ)


Two analytic, query-only fields derived from the same geometry:

SDF_move(p) — distance to nearest movement-blocking solid.

SDF_occl(p) — distance to nearest sight-blocking solid.

Layer membership (collider/occluder/emissive) is per-primitive and can toggle at runtime (doors, windows, grates, lights).

2) GeometryKernel (Authoritative Source of Truth)

Responsibilities

Own primitive sets + spatial acceleration.

Provide exact distance/gradient/raycast queries.

Perform runtime mutation (carve/toggle).

Persist deterministically (serialize/deserialize).

Public API (pure + deterministic)

Queries:

distanceMove(p) → ℝ

distanceOccl(p) → ℝ

raycastOccl(o, dir, maxT) → {hit, p, t, steps} via sphere tracing.

sweepCapsule(a→b, r) → continuous collision test (TOI/contact).

queryGradientMove(p) / queryGradientOccl(p) → ∇SDF (unit normal).

Mutations:

carve(bit, path, tags) → [geomId]

toggle(geomId, flags) → layer/state update

Persistence:

serialize() / deserialize()

Deterministic PRNG seeded by DungeonSeed.

SDF Composition

Union: SDF_union(p) = minᵢ SDFᵢ(p)

Subtraction (carving): BaseSolid(p) = +∞; SDF_carved(p) = max( -SDF_cut(p), BaseSolid(p) )

Movement uses Minkowski offset by actor radius at query time: allowed ⇔ distanceMove(p) − r > 0.

3) Analytic Primitives (Closed-Form)

Capsule (line segment with radius) — corridor core, corners, splines as short segments.

Box / Rotated box — square/rect-slot bits, doors, lintels.

Arc segment — circular sweeps (rounded turns).

Spline polyline — union of capsules per segment (analytic min).

Door slab / window pane / grate bars — boxes with layer tags.

Emissive lines/points/patches — non-blocking sources sampled by lighting.

All queries evaluated in double precision; distances are Euclidean (no raster).

4) Bits (Cutters) & Toolpaths

Bit Catalog (v1)

Circle — rounded corridor (capsule sweep).

Square — rectilinear corridor (rotated box sweep).

Rect-slot — rectangular hallway with semicircular end caps.

Squircular (optional) — superellipse (style interpolation).

Path Types

Linear, Arc, Spline (C¹ piecewise with segment caps).

Carve = analytic sweep of the bit along the param curve; insert result primitives into acceleration structure and layer sets.

5) Spatial Acceleration & Dirtying

Uniform Spatial Hash (default):

Bucket: (floor(x/cell), floor(y/cell)).

Query touches 3×3 neighboring buckets.

Carve/toggle marks affected buckets dirty; index updates are local.

BVH (optional):

Centroid-sorted nodes, cheap refit on batches of edits.

Per-layer indexing (move/occl) to avoid cross-traffic.

6) Minimal Bounding Region (MBR)

Definition: Smallest AABB covering all geometry that affects free space/visibility.

Computation:

AABB per primitive (exact/over-approx).

Union ⇒ MBR_raw.

Inflate by max(actorRadius, ε_ray, render_pad) ⇒ MBR.

Versioning: mbrVersion bumps on carves or geometry removal; most toggles do not grow MBR.

Use: Culling, ROI for queries, static layer redraw window, ray early-out beyond MBR+pad.

7) ECS Integration (SimClock / FXClock)

Components

World: GeometryRef{kernelId}, DungeonSeed{u32}

Actor: Position{x,y}, Facing{dx,dy}, Radius{r}, IntentMove{dx,dy}, FOVCache{rays,maxSteps,version}

Interactive: DoorTag{geomId,state}, EmissiveTag{geomId,intensity}, DigRequest{bitType,pathSpec}

SimClock Systems

InputSystem: map input → IntentMove (orthogonal).

MovementSystem:

Candidate p' = p + Δ where Δ aligned to N/E/S/W.

Continuous check: sweepCapsule(p→p', r). If penetration, compute TOI & stop at contact.

Optional slide: n = ∇SDF_move(contact), Δ' = Δ − dot(Δ,n)n; accept only if Δ' remains axis-aligned within tolerance.

DoorSystem: toggle(geomId) to open/close; update layer membership (occlusion-only windows; collision-only grates configurable).

DigSystem: consume DigRequest, run carve(bit,path,tags), dirty buckets, bump occlusion version for intersecting regions; emit CarveEvent.

FOVSystem (sphere tracing):

Rays against SDF_occl only.

Step t += max(d, ε_step) with d = distanceOccl(o + t·dir).

Stop when d < ε_hit or t > maxT.

Cache polyline per (pos, rays, maxSteps, occlVersionBucketSet); invalidate on actor move or local occlusion changes.

FXClock Systems

LightingSystem:

Emissives: sample visibility via raycastOccl to target; brightness I/(1+k·d²).

Ambient Occlusion: sample offsets around query point; integrate shadowed fraction via occlusion SDF.

RenderSystem:

Draw static walls from cached layer (invalidate on geometry change).

Overlay FOV polygon; visualize doors/windows according to state.

Use MBR ∩ view for draw culling.

8) Doors, Windows, Grates — Layer Semantics
Element	Movement	Sight	Notes
Door (closed)	blocks	blocks	slab lives in both or occl-only by design
Door (open)	pass	pass	slab toggled out of layers
Window	pass	blocks	occl-only
Grate	blocks	pass	move-only

Sockets (the carved opening) are part of free space; slabs control state via layer toggles.

9) Digging (Dynamic Carve)

Action → Request: DigRequest{bitType, pathSpec} (usually straight line).

Kernel: subtract sweep into chosen layers (move + occl typically).

Index: dirty affected buckets; update MBR if carve extends boundary.

FOV/Collision: invalidate caches for cones that intersect dirty buckets.

Replay: log CarveEvent(seed, bit, pathHash, ids) for determinism and undo/redo.

10) Numerical Behavior & Tolerances

Precision: doubles for all geometry and SDF evaluation.

Sphere tracing: ε_hit ≈ 0.2–0.5 world units (choose based on wall thickness), ε_step ≥ 0.5 to avoid stall in flats.

Gradient: central differences if analytic normal unavailable; step h chosen s.t. h ≪ wallThickness.

Clearance: enforce corridor width ≥ 2·actorRadius + margin.

Timeouts: hard cap on ray steps (e.g., 128–256) with early exit on leaving MBR+pad.

11) Performance Controls

Adaptive ray budget toward a target frame time.

Rays recompute only on actor move or local occlusion changes.

Static layer cache (walls/grid) redrawn on geometry change only.

Spatial hash cell size tuned near typical corridor width (≈ 1–2× bit diameter).

12) Determinism & Persistence

Seeded PRNG (e.g., mulberry32) for all procedural choices.

Event-sourced mutations: CarveEvent, ToggleEvent, input intents.

Serialization: primitives, layer membership, spatial index meta, MBR, versions.

Replay: identical geometry, SDF behavior, FOV polylines for the same event stream.

13) Validation & Regression Suite (no rendering assumptions)

Surface distance: on known surface points |SDF_move| < ε.

Contact move: stepping to a wall yields distanceMove − r ≈ 0.

Ray correctness: no FOV ray penetrates occluders; hits lie within ε of analytic surface.

Door toggles: closed blocks (per policy), open passes; FOV/paths update locally only.

Dig continuity: carve increases connectivity or merges components; never creates negative wall thickness.

MBR accounting: MBR grows on outward digs; unaffected by door toggles; culling never clips geometry.

Deterministic replay: hash of primitive stream and occlusion version set is stable.

14) Minimal Decisions to Lock for v1

Bit set: Circle, Square, Rect-slot (Squircular optional).

Door policy: closed blocks sight and movement (or sight-only); windows & grates per table above.

Actor radius and minimum corridor width (clearance rule).

Hash cell size (≈ corridor width) and sphere-tracing tolerances (ε_hit, ε_step, max steps).

Ray budget target (e.g., 60 FPS).
```


BoundingCircle (component) -- serves as collider, circular 
Facing (component) -- vector pointing in a direction 
Anatomy::StrideDistance -- serves as distance to move 
Anatomy::ReachDistance -- serves as distance to move 
FOV::distance -- combined with facing gives cone. 
FOV:angle -- gives field of view angle

We can potentially convert T/F bitmap into analytic dungeons, but that can come later.