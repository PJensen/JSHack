// --- ECS imports ---
import { World, startLoop } from './lib/ecs/core.js';
import { createFrom } from './lib/ecs/archetype.js';
import { PlayerArchetype } from './world/archetypes/PlayerArchetype.js';
import { Player } from './world/components/Player.js';
import { Position } from './world/components/Position.js';
import Glyph from './world/components/Glyph.js';

// --- Setup canvas ---
// Matches <canvas id="stage"> in index.html
const canvas = document.getElementById('stage');
if (!canvas) {
	throw new Error('Canvas element with id="stage" not found. Ensure index.html has <canvas id="stage">.');
}
const ctx = canvas.getContext('2d', { alpha: false });
canvas.style.imageRendering = 'pixelated';

// Ensure the canvas backing store matches the displayed CSS size and DPR to avoid stretching
const CELL_W = 16, CELL_H = 16; // square cells by default
function setupCanvasSize() {
	const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
	const cssW = Math.floor(window.innerWidth || canvas.clientWidth || 800);
	const cssH = Math.floor(window.innerHeight || canvas.clientHeight || 600);
	canvas.style.width = cssW + 'px';
	canvas.style.height = cssH + 'px';
	canvas.width = cssW * dpr;
	canvas.height = cssH * dpr;
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	return { dpr, cssW, cssH };
}
let { dpr, cssW, cssH } = setupCanvasSize();

// --- Create ECS world ---
const world = new World();

// --- Create player entity from archetype ---
const playerId = createFrom(world, PlayerArchetype, {
	Position: { x: 0, y: 0 }
});

// PlayerArchetype in this repo doesn't materialize component steps in a form
// compatible with our archetype helper, so ensure the entity has the
// components the renderer expects by adding them explicitly.
world.add(playerId, Position, { x: 0, y: 0 });
world.add(playerId, Player, { });
world.add(playerId, Glyph, { char: '@', fg: '#fff', color: '#fff' });

// --- Import renderer systems ---
import { setSystemOrder } from './lib/ecs/systems.js';
import { playerRendererSystem } from './world/systems/renderers/playerRendererSystem.js';
import { renderTilesSystem } from './world/systems/renderers/tileRendererSystem.js';
import { renderItemsSystem } from './world/systems/renderers/itemRendererSystem.js';
import { renderEffectsSystem } from './world/systems/renderers/effectRendererSystem.js';
import { renderPostProcessingSystem } from './world/systems/renderers/postProcessingRendererSystem.js';
import { RenderContext } from './world/components/RenderContext.js';
import { cameraSystem } from './world/systems/cameraSystem.js';
import { Camera } from './world/components/Camera.js';
import { dungeonGeneratorSystem } from './world/systems/dungeon/dungeonGeneratorSystem.js';
import { lifetimeSystem } from './world/systems/lifetimeSystem.js';
import { projectileSystem } from './world/systems/projectileSystem.js';

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
});
// Cache the RenderContext entity id on the world for fast access in render loops
world.renderContextId = rt;

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
world.system(lifetimeSystem, 'late');

// Add a Camera entity to hold viewport settings
const camEntity = world.create();
world.add(camEntity, Camera, { x: 0, y: 0, cols: 21, rows: 21 });

// --- Start ECS main loop ---
startLoop(world);

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
