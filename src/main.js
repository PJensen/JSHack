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

// PlayerArchetype in this repo doesn't materialize component steps in a form
// compatible with our archetype helper, so ensure the entity has the
// components the renderer expects by adding them explicitly.
// Ensure essential components exist (some older archetypes or callers may
// omit certain components); add only when missing.
if (!world.has(playerId, Position)) world.add(playerId, Position, { x: 0, y: 0 });
if (!world.has(playerId, Player)) world.add(playerId, Player, { });
if (!world.has(playerId, Glyph)) world.add(playerId, Glyph, { char: '@', fg: '#fff', color: '#fff' });

// --- Sprinkle some gold around the player ---
import { Gold } from './world/components/Gold.js';
const goldPositions = [
	{ x: -2, y: -2 }, { x: 2, y: -2 }, { x: -2, y: 2 }, { x: 2, y: 2 },
	{ x: -3, y: 0 }, { x: 3, y: 0 }, { x: 0, y: -3 }, { x: 0, y: 3 },
	{ x: 1, y: 1 }, { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }
];
goldPositions.forEach(pos => {
	const goldEntity = world.create();
	world.add(goldEntity, Position, { x: pos.x, y: pos.y });
	world.add(goldEntity, Gold, { amount: Math.floor(Math.random() * 50) + 10 });
	world.add(goldEntity, Glyph, { char: '$', fg: '#ffd700', color: '#ffd700' });
});

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
import { dungeonGeneratorSystem } from './world/systems/dungeon/dungeonGeneratorSystem.js';
import { lifetimeSystem } from './world/systems/lifetimeSystem.js';
import { projectileSystem } from './world/systems/projectileSystem.js';
import { effectLifetimeSystem } from './world/systems/effects/effectLifetimeSystem.js';
import { garbageCollectionSystem } from './world/systems/garbageCollectionSystem.js';
import { spawnFloatText } from './world/systems/effects/spawner.js';

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
world.system(renderItemsSystem, 'render');
world.system(renderEffectsSystem, 'render');
world.system(playerRendererSystem, 'render');
world.system(renderPostProcessingSystem, 'render');

// Explicit ordering ensures predictable render sequence
try { setSystemOrder('render', [renderTilesSystem, renderItemsSystem, renderEffectsSystem, playerRendererSystem, renderPostProcessingSystem]); } catch (e) { /* ignore */ }

// Register camera system in 'update' so camera follows player
world.system(cameraSystem, 'update');

// Register dungeon generator (no-op until Dungeon/DungeonLevel entities exist)
world.system(dungeonGeneratorSystem, 'update');

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
	} catch (e) {
		// If this races during startup, it's safe to ignore; next frame will update.
	}
});