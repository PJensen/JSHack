# 🜛 The Ten Commandments of JS-Hack ECS

## 1. Two Clocks, Forever Separate
There are two clocks—and never the twain shall meet:

**SimClock** — turn-based, deterministic, and authoritative.  
Advances only by explicit step or command. Governs all gameplay logic.

**FXClock** — real-time, non-deterministic, and ephemeral.  
Advances at display frame rate. Governs interpolation, easing, trails, particles, and camera motion.

The SimClock defines truth. The FXClock paints motion upon it.  
FX may interpolate between Sim ticks but must never cause one.  
Pause, resume, or slow-mo touch FX only unless explicitly defined otherwise.  
Sim time and FX time exist as ECS resources: `SimTimeResource` and `FXTimeResource`.

---

## 2. The Sim World Is Law
The Sim World is deterministic, authoritative, and serializable.  
No renderer or UI may mutate it. No I/O or real-time randomness lives inside it.

Randomness is seeded, deterministic, and pulled only from the `RNGResource`.  
All gameplay systems run on the same seed. Replays and saves rely on this.  

Every input becomes a **Command**, not an immediate mutation.  
All outcomes become **Events**, not side effects.  
A saved Sim World replays identically—bit for bit—when given the same commands and seed.

---

## 3. Rendering Is an Interpretation, Never a Source
Rendering lives in one or more **Presentation Worlds**.  
These are organizationally ECS-based, but visually driven and read-only.  

They consume snapshots and events from the Sim World.  
They interpolate, ease, and animate—but never write back.  
They own the **ViewModel layer**: screen positions, particle emitters, glow, trails, HUD, camera.  
If rendering disagrees with the Sim, the Sim still wins.

---

## 4. ECS First, Pixels Later
All logic belongs to ECS—entities, components, systems, queries.  
Entities are pure identity. Components are pure data. Systems are pure logic.

Global state lives only in **Resources**, not in singleton classes.  
Even UI state may live in ECS, but DOM and WebGL calls are external and read-only.  
No “manager” holds mutable state outside the ECS loop.  
Pixels are the last step, not the source of truth.

---

## 5. Thou Shalt Keep the Project Ordered
A clean project reflects a clean mind.

**Sim** — deterministic core (components, systems, resources).  
**Presentation** — visual and audio systems.  
**Bridge** — event projection and identity mapping.  
**Shared** — math, geometry, constants, contracts.  
**VFX** — particles, emitters, and FX nodes.

Import flows downward only:  
presentation → bridge → sim → shared.  

No upward imports.  
Components are **nouns**. Systems are **verb-nouns**.  
Events end in **Event**. Tags end in **Tag**. Resources end in **Resource**.

---

## 6. Commands, Events, and Scheduling Are Sacred
Nothing happens outside these three:

**Commands** — player or AI intents (`MoveCommand`, `CastSpellCommand`).  
Queued, canonical, and processed before each Sim tick.

**Events** — outcomes (`MovedEvent`, `DamageAppliedEvent`).  
Ephemeral, existing one tick only.

**Scheduling** — order and phase are explicit.  
`PreTick → SimTick → PostTick → FXTick`.

Within SimTick, declare dependencies—Movement before Combat, Combat before Death.  
Bridges publish read-only state diffs after SimTick for Presentation to consume.  

No hidden side effects. Ever.

---

## 7. Composition Above All
Prefer composition to inheritance. Data defines behavior.

Design **Archetypes** for hot paths.  
Keep components minimal—numbers, IDs, flags.  
Bundle them in predictable archetypes (`Actor`, `StaticTile`, etc.).  

Queries request only what they need.  
Measure every tick. If Sim overruns, slice and defer via Commands or Events.  
If FX overruns, degrade visuals—never break determinism.

---

## 8. Bridging Worlds Requires Discipline
Sim and View share identity, not memory.

A stable **IdentityMap** tracks `SimEntity → ViewEntity`.  
When a Sim entity becomes renderable, spawn its View mirror.  
When it dies, fade the View gracefully using FXClock.

The Bridge publishes **deltas**, not snapshots—compact, read-only summaries.  
Use `crossWorld.js` to mirror safely. No Sim mutation through View code.  
The bridge is the only crossing point. Guard it.

---

## 9. The VFX Pipeline Owns Motion Between Turns
Motion between turns is illusion, owned entirely by FX.

Interpolation and easing operate on presentation data using FXClock.  
Particles, trails, glows, and camera shake live here.  
Budgets exist: particle count, draw calls, frame cost.  
When limits are hit, degrade gracefully.

If a visual must influence gameplay, it emits a **Command**—never writes Sim directly.

---

## 10. The Complete Contract
JS-Hack ECS exists as a contract between truth (Sim) and perception (FX).  
Adhere to it and all systems remain deterministic, debuggable, and beautiful.

**Worlds:** Sim (authoritative), Presentation (read-only), optional Tooling.  
**Entities:** pure identity, created via systems.  
**Components:** pure data; tags carry no payload.  
**Systems:** stateless functions over queries.  
**Resources:** world-scoped singletons—SimTime, FXTime, RNG, CommandQueue, EventQueue, Map, IdentityMap, Camera.  
**Events:** transient, tick-bound, never persistent.  
**Hierarchy:** parent/child for transforms and UI trees, mirrored across worlds.  
**Serialization:** versioned and reproducible; FX always rebuilt from Sim.  
**Success Criterion:**  
Same seed + same commands → identical Sim outcome, regardless of FX or frame rate.

---

> ⚙️ *When in doubt: trust the Sim, respect the Bridge, and let the FX dance to their clocks.*
