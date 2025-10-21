// dungeonGeneratorSystem.js
// System: dungeonGeneratorSystem
// Purpose: Generates dungeon layouts and populates DungeonLevel and Tile components for dungeon entities.
// ECS conventions: Data in components, logic in systems. No external dependencies.

import { defineSystem, getEntitiesWithComponents, addComponent, getComponent, setComponent } from '../../../lib/ecs/core.js';
import { Dungeon } from '../../components/Dungeon.js';
import { DungeonLevel } from '../../components/DungeonLevel.js';
import { Tile } from '../../components/Tile.js';

// Simple random dungeon generator (rectangular room with random walls)
function generateDungeonLevel(width, height) {
    const tiles = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // Border = wall, interior = floor
            const isWall = x === 0 || y === 0 || x === width - 1 || y === height - 1;
            tiles.push({
                x,
                y,
                type: isWall ? 'wall' : 'floor',
            });
        }
    }
    // Add a random door
    const doorX = 1 + Math.floor(Math.random() * (width - 2));
    tiles.find(t => t.x === doorX && t.y === 0).type = 'door';
    return tiles;
}

export function dungeonGeneratorSystem(world) {
    // Find all entities with Dungeon and DungeonLevel, but no Tile (not yet generated)
    const entities = getEntitiesWithComponents(world, [Dungeon, DungeonLevel]);
    for (const eid of entities) {
        // Only generate if not already generated
        if (!getComponent(world, Tile, eid)) {
            const dungeonLevel = getComponent(world, DungeonLevel, eid);
            const width = dungeonLevel.width || 20;
            const height = dungeonLevel.height || 10;
            const tiles = generateDungeonLevel(width, height);
            // Assign a Tile component for each tile
            for (const tile of tiles) {
                const tileEid = world.createEntity();
                addComponent(world, Tile, tileEid);
                setComponent(world, Tile, tileEid, {
                    x: tile.x,
                    y: tile.y,
                    type: tile.type,
                    parent: eid, // Link to dungeon level entity
                });
            }
            // Mark as generated (optional: set a flag on DungeonLevel)
            dungeonLevel.generated = true;
        }
    }
}

defineSystem('dungeonGeneratorSystem', dungeonGeneratorSystem);
