Executive summary
The repo aligns well with the Prime Directive (zero stack, pure ES modules, relative imports, single HTML entry), and you’ve scaffolded a clean systems/ecs/data/core split.
The ECS layer and systems are partially wired but not runnable as-is due to missing components and a few API mismatches.
Determinism is not yet enforced (Math.random in AI, timestamping in logs is okay but worth noting).
The UX skeleton is in place (index.html + overlays + touch UI stubs) but unhooked from game state.
The path from the single-file implementation.html to a modular ECS is clear; the next steps are mainly about unifying component naming, fixing RNG usage, and introducing a minimal orchestration loop that uses phases.
Below is a detailed review followed by a concrete, updated TODO proposal.

Alignment with the One-Shot / Zero-Stack directive
Pure browser / ES modules: PASS
index.html uses <script type="module" src="./src/main.js"> with relative import paths including file extensions.
No bundlers or Node tooling.
Determinism and seedability: PARTIAL
rng.js is solid (Mulberry32, helper API).
AI uses Math.random(), and imports a non-existent randomInt(); needs to switch to seeded RNG.
MessageLog uses Date.now(); that doesn’t affect simulation determinism, only logging.
One file = one idea: PASS
Files are small and focused (systems, core components, data defs).
Mobile and Responsive skeleton: PASS (pending hooks)
<meta viewport>, canvas fill via CSS, touch UI scaffolding present.
ECS core readiness
core.js is imported by components (defineComponent) and is assumed to provide:
Component definitions and world management with world.system(fn, phase), world.query(...), world.getComponent(eid, name) or world.get(eid, Component), world.add, world.removeComponent, world.removeEntity, world.set, world.mutate, world.tick(dt), possibly startLoop(world). The systems depend on these.
API usage is mixed between:
Systems using string component names + getComponent().
Core helpers using component objects + get()/add()/set()/mutate().
Recommendation: Support both forms, but pick one convention for new code (suggest: component objects internally, string names are acceptable at query boundaries since you’ve standardized on PascalCase names).
Systems audit
movement.js
Contract: Requires Position + Velocity, updates pos using dt (Euler).
Deterministic: Yes.
Notes: Velocity component is missing; add a canonical definition.
ai.js
Contract: Requires AI + Position + Velocity. Picks new direction when cooldown ≤ 0.
Issues:
Imports { randomInt } from ../util/rng.js, but that function does not exist. The utility provides rngInt() (requires generator) and createRng() (has .int()).
Uses Math.random() for cooldown → not deterministic. Should use a seeded RNG (world RNG or system-local seeded generator).
Suggestion: Provide RNG via world or a system context, or import createRng(seed) in main bootstrap.
render.js
Contract: Requires Position + Renderable, draws rectangles + optional char.
Notes:
Renderable component is missing. Add with { color, char, charColor } as fields.
Uses fillText without setting font each frame; acceptable for prototype but define once on context when initializing for better consistency.
combat.js
Contract: Requires HP + PendingDamage, subtracts and emits death events.
Issues: HP and PendingDamage components are missing (while core/entity.js defines hp/maxHp within an Entity component).
Suggestion: Decide: either:
A) Use a dedicated HP component for systems and avoid duplicating hp in Entity; or
B) Adjust combat to mutate Entity.hp instead. Best for ECS clarity: A) introduce HP and refactor Entity (see Components section).
pickup.js
Contract: If entity with Inventory overlaps an Item, add item to inventory and remove item entity or strip Item component.
Issue: Inventory component is missing; needs definition.
index.js
Good aggregation. Registers render with its own phase. Assumes world phases sorted; ensure execution order is movement → ai → combat → pickup → render. If phases are string labels, make sure world enforces deterministic phase ordering.
Components and core modules
Present:
core/item.js defines an Item component and spawn helpers. Good.
core/equipment.js uses Entity.slots and item equip flows; consistent with Items.
core/entity.js defines an Entity component with stats (hp/maxHp/atk/def/level/xp) and slots.
core/tile.js is fine.
player.js defines Position and Player. Good.
core/message-log.js is a generally useful ring buffer (timestamped).
Missing components (referenced by systems, not yet defined):
Velocity (movement/ai)
Renderable (render)
AI (ai)
HP (combat) and PendingDamage (combat)
Inventory (pickup)
Naming cohesion (Entity vs HP):
Today Entity has hp/maxHp, but combat expects HP.
To avoid dupe truth and reduce coupling, pick a direction:
Option 1 (recommended): Introduce HP and gradually phase out hp/maxHp from Entity. Keep Entity focused on meta, growth, and slots.
Option 2: Use Entity in systems, delete HP references.
API cohesion:
Systems: string-based queries (world.query('Position','Renderable')) + getComponent().
Core helpers: world.get(eid, Component) and world.add/set/mutate().
As long as core.js handles both, this is OK. For new code, prefer component objects to leverage static defaults and avoid typos.
Data definitions
data is cleanly split:
item-defs.js, equip-defs.js, affix-defs.js, status-defs.js, monster-defs.js, and a federated defs.js that re-exports.
Implementation notes:
item-defs.js optionally includes executable script functions for effects. That’s fine in a zero-stack world as long as callers invoke them explicitly.
No side-effects on import—good.
Consistency:
Equip slots in EQUIP_DEFS include weapon, armor, ring, shield. Ensure these align with Entity.slots keys in core/entity.js (which currently uses head/body/main/off/feet/hands). There’s a mismatch:
Entity.slots: head, body, main, off, feet, hands
EQUIP_DEFS.slot: weapon, armor, ring, shield
You’ll need a slot mapping or to reconcile the slot taxonomy to avoid dead equipment logic.
UX skeleton and integration
index.html:
Canvas (#stage), title bar, HUD, overlays, touch UI, toast area—all present.
CSS sets touch-action:none on canvas; good for gestures.
main.js:
Handles canvas acquisition and resize; includes stubs for overlays, toasts, spell picker, keyboard fallbacks, and touch UI enabling.
Mentions window.JS_HOOKS for integration points. Good idea: acyclic dependency via hooks.
Missing: world bootstrap, entity spawning, system registration, game loop (fixed-step).
Gesture bindings exist but are UI-only. Eventually, they should synthesize input events or mutate ECS (e.g., set a DesiredMove or Intent component, or fire input events the ECS consumes deterministically).
Determinism and RNG
Good RNG module (rng.js) with createRng(seed), float/int/choice/shuffle helpers.
AI system currently non-deterministic (Math.random()), and the import for randomInt is incorrect.
Proposed pattern:
Create a deterministic RNG in bootstrap (const rng = createRng(seed)), attach to world or provide to systems via context (e.g., world.getService('rng')).
Replace all non-deterministic calls with RNG usage.
Logging stays timestamped—fine; but if you need replay-perfect logs, use a tick counter or simulation time.
Orchestration and loop
The TODO mentions orchestration.js with a Game class for input→simulate→render. Not present yet.
The ECS instruction also mentions startLoop(world) and world.tick(dt)—if provided by your core, wire it in main.js.
A minimal bootstrap should:
Create world with debug/strict flags.
Register systems in deterministic phases.
Seed RNG and inject into world/services context.
Spawn a player entity (Position, Velocity, Renderable, Inventory, HP, Player).
Start a fixed-step loop (e.g., 60 Hz) and tie resize to canvas scaling, not simulation.
Immediate defects and inconsistencies
Import mismatch:
ai.js: import { randomInt } from '../util/rng.js' does not exist.
Missing components referenced by systems:
Position exists (in player.js).
Missing: Velocity, Renderable, AI, HP, PendingDamage, Inventory.
Equipment slot mismatch:
Entity.slots vs EQUIP_DEFS.slot use different nomenclature.
Potential world API mismatch:
Systems use world.getComponent / world.removeComponent / world.removeEntity.
Core helpers use world.get/add/set/mutate.
Ensure core.js implements both styles or standardize.
Recommended decisions (to prevent churn)
Component taxonomy:
Standardize on these minimal components for v0:
Position { x, y }
Velocity { dx, dy }
Renderable { color, char?, charColor? }
HP { current, max }
PendingDamage { amount }
Inventory { items: [] }
AI { cooldown, behavior? }
Player { name }
Keep core/entity.js as “ActorMeta” (rename later) for XP/level/slots only; remove hp/maxHp over time to avoid duplication OR stop using HP component and stick with Entity.hp across the codebase. Pick one and commit.
RNG:
Single RNG per simulation, injected via world context; ban Math.random() in systems.
Equipment slots:
Choose one slot scheme. Suggest canonical set aligned with defs: weapon, armor, shield, ring1, ring2, head, body, hands, feet, offhand/mainhand if dual-wielding. Update either defs or entity slots.
Proposed updated TODO (prioritized)
Make the ECS demo runnable (compile- and tick-clean)
Add missing components:
src/components/velocity.js, renderable.js, hp.js, pending-damage.js, inventory.js, ai.js
Fix RNG usage:
Replace randomInt import in ai.js with deterministic RNG (createRng(seed)), injected via world/services
Remove Math.random() in systems
Reconcile equipment slot taxonomy:
Decide canonical slot names and update either EQUIP_DEFS or Entity.slots + equip logic
Verify world API:
Ensure world.getComponent/removeComponent/removeEntity exist or adjust systems to use world.get/add/set/mutate
Bootstrap in main.js:
Create World, register systems via index.js
Spawn a player with Position, Velocity, Renderable, HP, Inventory, Player
Start fixed-step loop (world.tick(dt)), decouple resize from dt
Deterministic input pipeline
Keyboard + touch gestures generate high-level intents:
Example components: DesiredMove { dx, dy }, UseItem, OpenOverlay, etc.
A small InputSystem turns intents into mutations (e.g., set Velocity or perform actions), then clears the intents
Add optional haptics on confirmed actions (navigator.vibrate when available)
Render polish
Set font, baseline, and letter-spacing for consistent char rendering
Optionally add a camera (offset) to center the player
Add a minimal grid or background to visualize movement
Integrate overlays with ECS
Inventory overlay reads Inventory.items and shows item defs (name/glyph)
Log overlay mirrors a MessageLog system (append messages on actions)
Spell overlay can remain UI-only for now; later hook to ECS (e.g., CastSpell intent)
Map and collisions (incrementally)
Introduce a Map holder and Tile usage
Add a BlocksMovement check in MovementSystem (AABB on grid) or query tiles/rules
Re-enable hasLine() in bresenham.js when map structure is ready
Mobile UX deliverables
js-hack-mobile-ui.html:
Single-file build with embedded modules (keep code readable and hackable)
Include: canvas, HUD, touch controls, overlays, title updater
Gesture system + keyboard synthesis layer within the module
README-Mobile-UX.md:
Usage instructions, toggles (e.g., show/hide touch UI), deterministic seed notes
Orchestration module
src/orchestration.js:
Defines the Game orchestrator (input → simulate → render), wires hooks (window.JS_HOOKS) to open overlays and dispatch intents
Exposes startLoop(world) if not already provided by core.js
Contains a tiny “contract” for phases: input (construct intents) → sim (ai/movement/combat/pickup) → render
Optional: Serialization and replay
Use serialization.js to snapshot/save seed + entity state
Support replays by feeding the same seed and input timeline
Testing and self-checks
Add a fast self-test mode in main.js:
Create RNG with fixed seed, tick N frames, assert positions/hp deltas
Show a small on-screen PASS toast for debug builds
Gesture system notes (from UX-TODO)
Map top-level gestures to intents:
Swipe Up → Open Inventory intent
Swipe Down → Open Spell List intent
Swipe Right → Open Combat Log intent
Long-Press → Quick-Select (stub intent)
Double-Tap Player Tile → Descend Stairs intent (fallback to Enter)
Tap HP Bar → Use Healing Item intent
Tap Mana Bar → Auto-Cast Current Spell intent
Each confirmed gesture triggers haptic feedback and a toast message
Ensure thresholds are tuned and platform-agnostic (remove scroll/pinch interactions on canvas)
Risks and edge cases to watch
API friction: world.getComponent vs world.get(eid, Comp). Choose one for consistency.
Duplicate truth for HP: If both Entity.hp and HP.current exist, bugs follow; unify.
Equipment slot naming mismatch: will silently break equip logic if not reconciled.
Determinism leakage: avoid Date-based logic in systems; keep all randomness via seeded RNG.
Performance with string-based queries: if world.query('Position','Renderable') is implemented via archetypes, great; otherwise consider caching.
Acceptance criteria for “first runnable ECS slice”
Build: Pass (no module import errors; no missing exports)
Seeded AI: No Math.random() inside systems
Minimal loop runs:
Player visible on canvas with a colored square or char
Arrow keys or D-pad moves player deterministically
HUD updates on a simple action (e.g., picking up an item decrements ground item count and shows a log entry)
Render deterministically with a fixed seed; position after N ticks is stable across runs.
Suggested TODO.md update (drop-in content)
Immediate
Add components: Velocity, Renderable, HP, PendingDamage, Inventory, AI
Fix RNG usage in AI; inject a seeded RNG (createRng) via world/context
Reconcile equipment slots between Entity.slots and EQUIP_DEFS.slot
Verify or adapt world API to support both component-object and string-based accessors consistently
Bootstrap world in main.js: register systems, spawn player, start fixed-step loop
Next
Input intents + InputSystem to translate keyboard/touch into ECS mutations
Hook overlays to ECS state (inventory listing, message log)
Map/tile collision checks in MovementSystem; re-enable Bresenham LOS helper when map exists
UX deliverables
Create js-hack-mobile-ui.html: single-file module version with canvas, HUD, touch UI, overlays, title updater, gestures
Write README-Mobile-UX.md with usage and toggles
Polish
Camera offset and font setup in RenderSystem
Serialization/replay hooks for deterministic testing
Tiny self-test mode with a PASS toast overlay