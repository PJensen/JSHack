// dungeonSystem.js
// Purpose: Generates simple dungeon tiles for entities with Dungeon + DungeonLevel
// Normalized to core World API (world.query/create/add/get/set)


import { Position } from '../../components/Position.js';
import { Tile } from '../../components/Tile.js';
import { Glyph } from '../../components/Glyph.js';

function randomDirection(rng) {
    // Only orthogonal directions
    const dirs = [
        [1, 0], [-1, 0], [0, 1], [0, -1]
    ];
    return dirs[Math.floor(rng() * dirs.length)];
}

export function dungeonGeneratorSystem(world) {
    // Only generate once per world
    if (world._dungeonGenerated) return;
    const rng = world.rng || Math.random;
    const numSegments = 100;
    const minLen = 3, maxLen = 30;
    const mapW = 160, mapH = 96; // Larger dungeon area

    for (let i = 0; i < numSegments; ++i) {
        // Pick a random start position
        let x = Math.floor(rng() * mapW);
        let y = Math.floor(rng() * mapH);
        // Pick a random direction
        const [dx, dy] = randomDirection(rng);
        // Pick a random length
        const len = minLen + Math.floor(rng() * (maxLen - minLen + 1));

        for (let j = 0; j < len; ++j) {
            // Clamp to map bounds
            if (x < 0 || x >= mapW || y < 0 || y >= mapH) break;
            const id = world.create();
            world.add(id, Position, { x, y });
            world.add(id, Tile, { type: 'wall' });
            world.add(id, Glyph, { char: '#', fg: '#888' });
            x += dx;
            y += dy;
        }
    }
    world._dungeonGenerated = true;
}
