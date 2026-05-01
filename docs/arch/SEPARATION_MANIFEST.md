# Separation Manifest

Authoritative guide for keeping the deterministic simulation clean and all presentation flexible. Thinking is cheap; code is expensive.

## Top-level layout

/src/
  rules/      — pure deterministic simulation
  bridge/     — neutral contract (snapshots, events, readers)
  display/    — rendering, VFX, lighting, camera, input
  scenes/     — optional orchestration (camera cues, flow)
  shared/     — pure utilities (math, types)
  app/        — composition roots (playable, headless)
reference/
tests/

## Hard boundaries (who can import whom)

- rules/ may import: shared/
  - MUST NOT import: bridge/, display/, scenes/, DOM, timers, rAF
- bridge/ may import: rules/ (read-only selectors), shared/
  - Exposes: schema/ (DTOs), readers/ (snapshot builders), codecs/
  - MUST NOT import: display/, scenes/
- display/ may import: bridge/ (schema + readers), shared/
  - MUST NOT import: rules/
- scenes/ may import: bridge/, display/ (signals/director APIs), shared/, a tiny rulesApi façade provided by app/
  - MUST NOT import: rules/ internals directly
- app/ wires everything; owns rulesApi and lifecycle; no game logic

If in doubt: rules → bridge → display. Never the reverse.

## Determinism policy

- Only app/scenes call SimClock.step(dt). No rAF or timers exist in rules/.
- Given the same seed and intent sequence, the sim produces identical state/events.
- Visual randomness is allowed in display/ but never feeds back into rules/.

## Camera policy

- Camera is a display resource (not an ECS component): display/camera/*
- One primary camera controlling world→screen transform (x, y, scale).
- Cinematics (jump, ease, follow, shake, zoom) are driven by display-side director.

## Lighting policy

- All lighting math lives under display/lighting/.
- rules/ only exposes semantic tags (e.g., Tag_Emissive); no radii, colors, or falloff.
- display derives light sources from snapshot emissives and computes light fields.

## Bridge: data contract

Schema shapes (stable, serializable, read-only):

WorldView
{
  turn: number,
  seed: number,
  player: { id: number, pos: { x: number, y: number } } | null,
  invulnTurns: number,
  entities: Array<{
    id: number,
    kind: string,          // archetype or semantic kind
    pos: { x: number, y: number },
    tags: string[]         // semantic tags only
  }>,
  solids: Array<{ id: number, x: number, y: number }>,
  emissives: Array<{ id: number, x: number, y: number, kind: string }>
}

Events (semantic only; no pixels/brightness):
- moved { id, from:{x,y}, to:{x,y} }
- damage { id, amount, at:{x,y} }
- died { id, at:{x,y} }
- spawned { id, at:{x,y}, kind }

No light.* events. Lighting is visual-side logic.

Readers (examples):
- readers/world_view.build(world): WorldView
- readers/spotlight.resolve(world, { id }): { x, y } | null

## Display: presentation contract

- Renders using only WorldView data; never mutates sim state.
- Maps entity kind/tags → visuals via palette tables (glyphs, colors, styles).
- Pass pipeline: tiles/glyphs → lightmask → vfx → hud.
- VFX own their lifetimes in visual time; may consume bridge events.

## Scenes: orchestration

- Optional director that sequences camera + display cues and decides when to step the sim.
- Scenes never touch ECS directly; they:
  - call rulesApi (façade in app/) for spawn/name/invuln/step
  - emit display signals for camera/VFX/UI

Example minimal rulesApi (owned by app/):
- newWorld(seed)
- generateDungeon(options?)
- spawnPlayer({ name }) → id
- applyInvulnerable(entityId, turns)
- step(dt=1)

## Input flow

DOM → display/input → rules/io intents → app.rulesApi.step() →
bridge readers build WorldView → display renders passes.

## “Blue o” rule

- Glyphs/colors/animations are presentation concerns only.
- Rules expose kind/tags/positions; display decides visuals.
- If symbols have gameplay meaning, add a semantic component in rules/ (e.g., Symbol { code }) — still no visuals in rules/.

## Quick checklist before merging

- [ ] No references to DOM, window, or rAF in rules/
- [ ] No imports from rules/ inside display/
- [ ] Bridge exports only plain data; no live component references
- [ ] Camera used only as a display resource
- [ ] Lighting exists only under display/lighting/
- [ ] Visual mappings (glyphs/palette) live in display/, not rules/
- [ ] WorldView stable; additions happen via bridge/schema first

## Notes

- The “giant @” intro is camera.scale >> 1, not a different entity.
- Invulnerability pulse for first N turns is a display VFX keyed off WorldView.invulnTurns.
- Headless tests run purely against rules/ with deterministic seeds and intent sequences.
