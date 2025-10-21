// Tile Renderer System
// Responsible for rendering the tilemap/background layer
// Assumes existence of tile, position, and visibility components
import { RenderContext } from '../../components/RenderContext.js';
import { getRenderContext } from './renderingUtils.js';

export function renderTilesSystem(world) {
        const ctxRec = getRenderContext(world);
        if (!ctxRec) return;
        const { ctx, W, H } = ctxRec;
        // Very small demo map: build a 41x41 tile map centered around 0,0
        const cols = 41, rows = 41;
        const tileSize = 16;

        // Find camera (use first Camera component if present)
        let camX = -Math.floor(cols/2), camY = -Math.floor(rows/2);
        const cam = world.query; // placeholder to avoid unused warnings

        // draw a simple checkerboard floor + border walls
        const startX = -Math.floor(cols/2);
        const startY = -Math.floor(rows/2);
        ctx.save();
        ctx.fillStyle = '#222';
        ctx.fillRect(0,0,W,H);
        ctx.translate((W - cols*tileSize)/2, (H - rows*tileSize)/2);
        for (let y=0;y<rows;y++){
            for (let x=0;x<cols;x++){
                const worldX = startX + x;
                const worldY = startY + y;
                const isWall = (Math.abs(worldX) === Math.floor(cols/2)) || (Math.abs(worldY) === Math.floor(rows/2));
                ctx.fillStyle = isWall ? '#444' : ((x+y)%2 ? '#2a2a2a' : '#303030');
                ctx.fillRect(x*tileSize, y*tileSize, tileSize, tileSize);
            }
        }
        ctx.restore();
}
