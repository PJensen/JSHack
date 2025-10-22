// --- ECS imports ---
import { World, startLoop } from './lib/ecs/core.js';
import { createFrom } from './lib/ecs/archetype.js';
import { PlayerArchetype } from './world/archetypes/PlayerArchetype.js';
import { Player } from './world/components/Player.js';
import { Position } from './world/components/Position.js';
import Glyph from './world/components/Glyph.js';

// --- Setup canvas ---
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.style.imageRendering = 'pixelated';
const W = canvas.width;
const H = canvas.height;

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

// --- Context object for rendering ---
const renderContext = { ctx, W, H };

// --- Register render systems in ECS (directly, no wrappers) ---
// Set the shared renderContext for renderer modules to read
// Create a RenderTarget entity to hold canvas/context info for render systems
const rt = world.create();
world.add(rt, RenderContext, {
	canvas,
	ctx,
	W: canvas.width,
	H: canvas.height,
	font: '18px monospace',
	cols: 41,
	rows: 41,
	cellW: 16,
	cellH: 16,
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
