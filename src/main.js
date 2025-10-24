// --- ECS imports ---
import './util/version.js';

import { World, startLoop } from './lib/ecs/core.js';
import { createFrom } from './lib/ecs/archetype.js';
import { PlayerArchetype } from './world/archetypes/PlayerArchetype.js';
import { Player } from './world/components/Player.js';
import { Position } from './world/components/Position.js';
import { Glyph } from './world/components/Glyph.js';

// --- Setup canvas ---
// Matches <canvas id="stage"> in index.html
const canvas = document.getElementById('stage');
if (!canvas) {
	throw new Error('Canvas element with id="stage" not found. Ensure index.html has <canvas id="stage">.');
}
const ctx = canvas.getContext('2d', { alpha: false });
canvas.style.imageRendering = 'pixelated';

// Ensure the canvas backing store matches the displayed CSS size and DPR to avoid stretching
// and avoid unbounded backing sizes on very large viewports / high-DPR displays which
// can cause out-of-memory crashes in some browsers/platforms.
const CELL_W = 16, CELL_H = 16; // square cells by default
// Maximum allowed backing size (in physical pixels) for width/height. Tweak if your
// target devices safely support larger canvases.
const MAX_BACKING_WIDTH = 8192;
const MAX_BACKING_HEIGHT = 8192;

function setupCanvasSize() {
	// Use the devicePixelRatio as a hint for backing resolution, but clamp
	// the final backing pixel dimensions so we never allocate a canvas
	// larger than MAX_BACKING_* which can cause Out-Of-Memory in some browsers.
	const rawDpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
	const cssW = Math.floor(window.innerWidth || canvas.clientWidth || 800);
	const cssH = Math.floor(window.innerHeight || canvas.clientHeight || 600);

	canvas.style.width = cssW + 'px';
	canvas.style.height = cssH + 'px';

	// Desired backing size in physical pixels
	const desiredW = cssW * rawDpr;
	const desiredH = cssH * rawDpr;

	// Clamp backing size to configured maximums
	const backingW = Math.min(desiredW, MAX_BACKING_WIDTH);
	const backingH = Math.min(desiredH, MAX_BACKING_HEIGHT);

	// Compute the actual DPR that will be used (may be fractional when CSS size
	// exceeds MAX_BACKING_* even at DPR=1). Use the backing->CSS ratio so the
	// canvas is rendered at the correct visual size while preventing huge
	// backing buffers.
	const actualDprW = backingW / Math.max(1, cssW);
	const actualDprH = backingH / Math.max(1, cssH);
	const actualDpr = Math.min(actualDprW, actualDprH);

	if (actualDpr < rawDpr) {
		console.warn(`Reduced backing DPR from ${rawDpr} -> ${actualDpr.toFixed(3)} to avoid excessive canvas size (${backingW}x${backingH}).`);
	}

	// Apply integer canvas dimensions (round to avoid fractional pixel sizes)
	canvas.width = Math.max(1, Math.round(backingW));
	canvas.height = Math.max(1, Math.round(backingH));

	// Set transform to map CSS pixels -> backing pixels using actual DPR
	ctx.setTransform(actualDpr, 0, 0, actualDpr, 0, 0);

	// Return the effective DPR (may be fractional) along with CSS sizes
	return { dpr: actualDpr, cssW, cssH };
}
let { dpr, cssW, cssH } = setupCanvasSize();

// --- Create ECS world ---
const world = new World();
world.storeMode = 'map'; // use Map storage for flexibility


// --- Create player entity from archetype ---
const playerId = createFrom(world, PlayerArchetype, {
	Position: { x: 0, y: 0 }
});

// --- Add a short occluding wall (4 tiles wide) in front of the player ---
import { Occluder } from './world/components/Occluder.js';
import { Tile } from './world/components/Tile.js';
{
	const playerPos = world.get(playerId, Position) || { x: 0, y: 0 };
	// Place wall 1 tile in front of player (assuming +y is "down")
	const wallY = playerPos.y + 1;
	const wallX0 = playerPos.x - 2;
	for (let dx = 0; dx < 4; ++dx) {
		const wx = wallX0 + dx;
		const wallId = world.create();
		world.add(wallId, Position, { x: wx, y: wallY });
		world.add(wallId, Glyph, { char: '#', fg: '#888', bg: '#222' });
		// Make this wall block light and movement
		world.add(wallId, Tile, { glyph: '#', walkable: false, blocksLight: true });
		world.add(wallId, Occluder, { opacity: 1.0, thickness: 1.0 });
	}
}

// --- Add an impassable L-shaped wall 5 tiles from the player ---
{
	const p = world.get(playerId, Position) || { x: 0, y: 0 };
	// Define the L corner exactly 5 tiles to the right of the player
	const cx = p.x + 5;
	const cy = p.y + 0;
	const LEG_LEN = 5; // number of tiles including the corner

	// Horizontal leg: to the right from the corner
	for (let i = 0; i < LEG_LEN; i++) {
		const e = world.create();
		world.add(e, Position, { x: cx + i, y: cy });
		world.add(e, Glyph, { char: '#', fg: '#aaa', bg: '#333' });
		world.add(e, Tile, { glyph: '#', walkable: false, blocksLight: true });
		world.add(e, Occluder, { opacity: 1.0, thickness: 1.0 });
	}
	// Vertical leg: downward from the corner
	for (let j = 1; j < LEG_LEN; j++) { // start at 1 to avoid duplicating the corner
		const e = world.create();
		world.add(e, Position, { x: cx, y: cy + j });
		world.add(e, Glyph, { char: '#', fg: '#aaa', bg: '#333' });
		world.add(e, Tile, { glyph: '#', walkable: false, blocksLight: true });
		world.add(e, Occluder, { opacity: 1.0, thickness: 1.0 });
	}
}

// PlayerArchetype in this repo doesn't materialize component steps in a form
// compatible with our archetype helper, so ensure the entity has the
// components the renderer expects by adding them explicitly.
// Ensure essential components exist (some older archetypes or callers may
// omit certain components); add only when missing.
if (!world.has(playerId, Position)) world.add(playerId, Position, { x: 0, y: 0 });
if (!world.has(playerId, Player)) world.add(playerId, Player, { });
if (!world.has(playerId, Glyph)) world.add(playerId, Glyph, { char: '@', fg: '#fff', color: '#fff' });

// Add InputIntent component for player input
import { InputIntent } from './world/components/InputIntent.js';
world.add(playerId, InputIntent, { dx: 0, dy: 0 });

// --- Sprinkle some gold randomly around the player (deterministic via world.rand) ---
import { Gold } from './world/components/Gold.js';
{
	// Spawn N piles of gold within a radius around the player's current position
	const playerPos = world.get(playerId, Position) || { x: 0, y: 0 };
	const NUM_PILES = 18;
	const RADIUS = 5; // in tiles (Chebyshev distance)
	const used = new Set(); // keys like "x,y"

	let attempts = 0, created = 0;
	while (created < NUM_PILES && attempts < NUM_PILES * 10) {
		attempts++;
		const dx = (world.rand() * (2 * RADIUS + 1) | 0) - RADIUS;
		const dy = (world.rand() * (2 * RADIUS + 1) | 0) - RADIUS;
		if (dx === 0 && dy === 0) continue; // not on the player
		const x = playerPos.x + dx;
		const y = playerPos.y + dy;
		const k = x + ',' + y;
		if (used.has(k)) continue;
		used.add(k);

		const goldEntity = world.create();
		world.add(goldEntity, Position, { x, y });
		const amount = 5 + ((world.rand() * 46) | 0); // 5..50
		world.add(goldEntity, Gold, { amount });
		world.add(goldEntity, Glyph, { char: '$', fg: '#ffd700', color: '#ffd700' });
		created++;
	}
}

// --- Import renderer systems ---
import { setSystemOrder } from './lib/ecs/systems.js';
import { playerRendererSystem } from './world/systems/renderers/playerRendererSystem.js';
import { renderTilesSystem } from './world/systems/renderers/tileRendererSystem.js';
import { renderItemsSystem } from './world/systems/renderers/itemRendererSystem.js';
import { renderEffectsSystem } from './world/systems/renderers/effectRendererSystem.js';
import { renderPostProcessingSystem } from './world/systems/renderers/postProcessingRendererSystem.js';
import { RenderContext } from './world/components/RenderContext.js';
import { createParticleSystem } from './world/systems/effects/particleSystem.js';
import { cameraSystem } from './world/systems/cameraSystem.js';
import { Camera } from './world/components/Camera.js';
import { dungeonSystem } from './world/systems/dungeon/dungeonSystem.js';
import { lifetimeSystem } from './world/systems/lifetimeSystem.js';
import { projectileSystem } from './world/systems/projectileSystem.js';
import { effectLifetimeSystem } from './world/systems/effects/effectLifetimeSystem.js';
import { garbageCollectionSystem } from './world/systems/garbageCollectionSystem.js';
import { spawnFloatText, spawnParticleBurst } from './world/systems/effects/spawner.js';
import { inputSystem, setupInputListeners } from './world/systems/inputSystem.js';
import { movementSystem } from './world/systems/movementSystem.js';
import { goldPickupSystem } from './world/systems/goldPickupSystem.js';
// Lighting systems
import { FlickerSystem } from './world/systems/lighting/FlickerSystem.js';
import { ShadowCastSystem } from './world/systems/lighting/ShadowCastSystem.js';
import { SpecularFieldSystem } from './world/systems/lighting/SpecularFieldSystem.js';
import { ensureCameraLighting } from './world/singletons/CameraLighting.js';
import { TileLightingRenderer } from './world/render/TileLightingRenderer.js';
import { SmoothLightGlowRenderer } from './world/render/SmoothLightGlowRenderer.js';
import { EntityLightingRenderer } from './world/render/EntityLightingRenderer.js';
import { BloomRenderer } from './world/render/BloomRenderer.js';
import { Light } from './world/components/Light.js';
import { Emissive } from './world/components/Emissive.js';
import { Material } from './world/components/Material.js';
import { FieldOfViewSystem } from './world/systems/lighting/FieldOfViewSystem.js';

// --- Context object for rendering (kept for potential module sharing) ---
const renderContext = { ctx };

// --- Register render systems in ECS (directly, no wrappers) ---
// Set the shared renderContext for renderer modules to read
// Create a RenderTarget entity to hold canvas/context info for render systems
const rt = world.create();
world.add(rt, RenderContext, {
	canvas,
	ctx,
	W: cssW, // CSS pixel space (ctx is scaled by DPR)
	H: cssH,
	font: '18px monospace',
	cols: Math.max(1, Math.floor(cssW / CELL_W)),
	rows: Math.max(1, Math.floor(cssH / CELL_H)),
	cellW: CELL_W,
	cellH: CELL_H,
	bg: '#0f1320',
	pixelated: true
	,
	// pre-create particle pool so renderers can rely on it immediately
	particleSystem: createParticleSystem({ poolSize: 512 })
});
// Cache the RenderContext entity id on the world for fast access in render loops
world.renderContextId = rt;

// Startup assertion: ensure the RenderContext has a particleSystem instance so renderers can rely on it.
try{
	const rc = world.get(rt, RenderContext);
	console.assert(rc && rc.particleSystem, 'RenderContext.particleSystem missing — particle effects may not render');
	// Warning commented out to reduce console noise
	// if (!rc || !rc.particleSystem) console.warn('RenderContext has no particleSystem; spawnParticleBurst will create one on demand.');
}catch(e){ /* ignore in constrained runtimes */ }

// Ensure DevState singleton exists and assert presence (dev-only)
import { makeSingleton } from './lib/ecs/core.js';
import { DevState } from './world/components/DevState.js';
try{
	const [_c, ensureDev] = makeSingleton(world, DevState);
	const devId = ensureDev();
	const dev = world.get(devId, DevState);
	console.assert(dev, 'DevState singleton not created');
}catch(e){ /* ignore in constrained runtimes */ }

// register renderers in order: tiles first, then items/effects, player, post-processing
world.system(renderTilesSystem, 'render');
// Lighting background pass overlays tiles with tone-mapped light
world.system(TileLightingRenderer, 'render');
// Add smooth additive glow for lights (soft halos)
world.system(SmoothLightGlowRenderer, 'render');
world.system(renderItemsSystem, 'render');
world.system(renderEffectsSystem, 'render');
// Modulate entities with lighting/specular
world.system(EntityLightingRenderer, 'render');
world.system(playerRendererSystem, 'render');
// Optional bloom pass
world.system(BloomRenderer, 'render');
world.system(renderPostProcessingSystem, 'render');

// Explicit ordering ensures predictable render sequence
try { setSystemOrder('render', [renderTilesSystem, TileLightingRenderer, SmoothLightGlowRenderer, renderItemsSystem, renderEffectsSystem, EntityLightingRenderer, playerRendererSystem, BloomRenderer, renderPostProcessingSystem]); } catch (e) { /* ignore */ }

// Register input system (captures keyboard input, translates to InputIntent)
setupInputListeners(); // Initialize keyboard event listeners

world.system(inputSystem, 'update');

// Register movement system (processes InputIntent and updates Position)
world.system(movementSystem, 'update');

// Register gold pickup handler (after movement so we resolve collisions this frame)
world.system(goldPickupSystem, 'update');

// Lighting systems ordering in update/late phases
world.system(FlickerSystem, 'update');
// Compute FOV mask separate from lighting so renderers can gate visibility
world.system(FieldOfViewSystem, 'update');
world.system(ShadowCastSystem, 'update');
world.system(SpecularFieldSystem, 'late');

// UI/Effects: respond to gold pickup events by spawning a float text indicator
try {
	world.on('gold:pickup', (ev) => {
		if (!ev || typeof ev.amount !== 'number') return;
		const x = ev.x ?? 0, y = ev.y ?? 0;
		// Nudge the float text a few pixels near the player so it feels anchored.
		// Convert small pixel jitter to tile units so effectRenderer mapping stays consistent.
		const r = (typeof world.rand === 'function' ? world.rand() : Math.random);
		const rx = (typeof r === 'function' ? r() : Math.random());
		const ry = (typeof r === 'function' ? r() : Math.random());
		const jitterPx = 6; // ~6px radius jitter
		const dxTiles = ((rx * 2 - 1) * jitterPx) / CELL_W;
		const dyTiles = (((ry * 2 - 1) * jitterPx) - 4) / CELL_H; // slight bias upward
		spawnFloatText(world, x + dxTiles, y + dyTiles, `+${ev.amount}`, { color: '#ffd700', ttl: 1.5, batch: true });

		// Dumb nightly delight: when gold is picked up, spawn another gold in a random location.
		try {
			// Prefer a random tile within the current viewport so it's visible.
			let nx = x, ny = y;
			const rcId = world.renderContextId;
			const rc = rcId ? world.get(rcId, RenderContext) : null;
			if (rc && typeof rc.cols === 'number' && typeof rc.rows === 'number'){
				const cols = Math.max(1, rc.cols|0);
				const rows = Math.max(1, rc.rows|0);
				const camX = rc.camX|0;
				const camY = rc.camY|0;
				// simple attempts to avoid spawning right on the player tile
				for (let i=0;i<8;i++){
					const ux = (typeof r === 'function' ? r() : Math.random());
					const uy = (typeof r === 'function' ? r() : Math.random());
					nx = camX + ((ux * cols) | 0);
					ny = camY + ((uy * rows) | 0);
					if (nx !== x || ny !== y) break;
				}
			} else {
				// Fallback: random offset around pickup location
				const R = 6;
				nx = x + (((typeof r === 'function' ? r() : Math.random()) * (2*R+1))|0) - R;
				ny = y + (((typeof r === 'function' ? r() : Math.random()) * (2*R+1))|0) - R;
				if (nx === x && ny === y) ny += 1; // nudge off the player tile
			}
			const e = world.create();
			world.add(e, Position, { x: nx, y: ny });
			const amt = 5 + (((typeof r === 'function' ? r() : Math.random()) * 46) | 0); // 5..50
			world.add(e, Gold, { amount: amt });
			world.add(e, Glyph, { char: '$', fg: '#ffd700', color: '#ffd700' });
		} catch (spawnErr) { /* ignore spawn issues for this dumb nightly feature */ }
		// // Subtle gold sparkle burst
		// spawnParticleBurst(world, {
		// 	x, y,
		// 	count: 10,
		// 	spread: Math.PI * 2,
		// 	speed: 1.2,
		// 	life: 0.6,
		// 	color: '#ffd700',
		// 	size: 0.9,
		// 	sizeEnd: 0.1,
		// 	ay: -0.6
		// });
	});
} catch (e) { /* ignore in constrained runtimes */ }

// Register camera system in 'update' so camera follows player
world.system(cameraSystem, 'update');

// Register dungeon generator (no-op until Dungeon/DungeonLevel entities exist)
world.system(dungeonSystem, 'update');

// Register projectile motion and lifetime cleanup
world.system(projectileSystem, 'update');

// Tick VFX lifetimes
world.system(effectLifetimeSystem, 'update');

// Update global particle system each tick so particles age and return to the pool.
// Without this, spawned particles are never updated/released and will grow unbounded.
world.system(function particleUpdateSystem(world, dt){
	try{
		const rcId = world.renderContextId;
		if (!rcId) return;
		const rc = world.get(rcId, RenderContext);
		const ps = rc && rc.particleSystem;
		if (!ps || typeof ps.update !== 'function') return;
		ps.update(dt);
	}catch(e){ console.warn('particleUpdateSystem error', e); }
}, 'update');

// Register lifetime system in 'late' to clean up expired entities after other updates
world.system(lifetimeSystem, 'late');
// Run garbage collector to clean Dead entities and trim pools
world.system(garbageCollectionSystem, 'late');

// Add a Camera entity to hold viewport settings
const camEntity = world.create();

world.add(camEntity, Camera, { x: 0, y: 0, cols: 21, rows: 21 });

// Create camera lighting singleton
try{ ensureCameraLighting(world); }catch(e){ /* ignore */ }

// --- Demo lighting entities: Torch and Lava tile ---
try{
	const ppos = world.get(playerId, Position) || { x:0, y:0 };
	// Torch near player
	const torch = world.create();
	world.add(torch, Position, { x: ppos.x + 3, y: ppos.y });
	world.add(torch, Light, { kind:'point', color:[1.0,0.6,0.2], radius:6, intensity:4, flickerSeed:42, castsShadows:true });
	world.add(torch, Emissive, { color:[1.0,0.4,0.1], strength:2, radius:1 });

	// Give player a basic material so specular is visible
	if (!world.has(playerId, Material)){
		world.add(playerId, Material, { albedo:[0.9,0.9,1.0], roughness:0.5, metalness:0.1, specular:0.5 });
	}

	// Lava emissive tile
	const lava = world.create();
	world.add(lava, Position, { x: ppos.x - 4, y: ppos.y + 2 });
	world.add(lava, Emissive, { color:[1.0,0.3,0.0], strength:3, radius:1 });
}catch(e){ /* ignore demo spawn errors */ }

// --- Start ECS main loop ---
startLoop(world);

// Demo: spawn some float text near player so we can immediately see effects
try {
	spawnFloatText(world, 2, 2, '-5', { color:'#9ff', dmg:5, batch:true });
	spawnFloatText(world, 2, 3, '+8', { color:'#fff59e', dmg:8, crit:true });
} catch(e) { /* ignore in non-demo contexts */ }

// Keep canvas/resolution in sync with viewport to avoid stretching and keep tiles square
window.addEventListener('resize', () => {
	({ dpr, cssW, cssH } = setupCanvasSize());
	try {
		world.set(rt, RenderContext, {
			W: cssW,
			H: cssH,
			cols: Math.max(1, Math.floor(cssW / CELL_W)),
			rows: Math.max(1, Math.floor(cssH / CELL_H))
		});
		// Keep Camera viewport in sync with RenderContext so camera centering matches renderers
		try{
			const rc = world.get(rt, RenderContext);
			if (rc && typeof rc.cols === 'number' && typeof rc.rows === 'number'){
				world.set(camEntity, Camera, { cols: rc.cols, rows: rc.rows });
			}
		}catch(e){ /* ignore if camera not yet created */ }
	} catch (e) {
		// If this races during startup, it's safe to ignore; next frame will update.
	}
});