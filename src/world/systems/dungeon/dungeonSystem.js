// dungeonSystem.js
// Purpose: Generates simple dungeon tiles for entities with Dungeon + DungeonLevel
// Normalized to core World API (world.query/create/add/get/set)

import { Dungeon } from '../../components/Dungeon.js';
import { DungeonLevel } from '../../components/DungeonLevel.js';
import { Tile } from '../../components/Tile.js';
import { Position } from '../../components/Position.js';
import { CONFIG } from '../../../config.js';

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

export function dungeonSystem(world) {
    // For each dungeon level, if not generated, create a simple map of tiles
    for (const [eid, dng, lvl] of world.query(Dungeon, DungeonLevel)) {
        if (lvl.generated) continue;
    // Clamp requested level sizes to a safe maximum to avoid creating
    // tens of thousands of entities and causing OOM.
    const requestedW = lvl.width || 120;
    const requestedH = lvl.height || 120;
    const MAX_DIM = Math.max(81, Math.max(CONFIG.cols || 80, CONFIG.rows || 48) * 4); // allow somewhat larger than viewport
    const width = Math.min(requestedW, MAX_DIM);
    const height = Math.min(requestedH, MAX_DIM);
        const tiles = generateDungeonLevel(width, height);
        for (const t of tiles) {
            const tid = world.create();
            world.add(tid, Position, { x: t.x, y: t.y });
            world.add(tid, Tile, {
                glyph: t.type === 'wall' ? '#' : t.type === 'door' ? '+' : '.',
                walkable: t.type !== 'wall',
                blocksLight: t.type === 'wall'
            });
            // Optionally link to parent via a component or tag if needed
        }
        // mark as generated
        world.set(eid, DungeonLevel, { generated: true });
    }
}
