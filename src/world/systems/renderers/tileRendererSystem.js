// Tile Renderer System
// Responsible for rendering the tilemap/background layer
// Assumes existence of tile, position, and visibility components
// READONLY: This renderer performs no mutations - only reads world state and draws to canvas
import { getRenderContext } from './renderingUtils.js';
import { Position } from '../../components/Position.js';
import { Tile } from '../../components/Tile.js';
import { Glyph } from '../../components/Glyph.js';

export function renderTilesSystem(world) {
    // --- FPS Indicator ---
    if (!renderTilesSystem._lastTime) renderTilesSystem._lastTime = performance.now();
    if (!renderTilesSystem._frameCount) renderTilesSystem._frameCount = 0;
    if (!renderTilesSystem._fps) renderTilesSystem._fps = 0;
    const now = performance.now();
    renderTilesSystem._frameCount++;
    if (now - renderTilesSystem._lastTime > 500) {
        renderTilesSystem._fps = Math.round(1000 * renderTilesSystem._frameCount / (now - renderTilesSystem._lastTime));
        renderTilesSystem._frameCount = 0;
        renderTilesSystem._lastTime = now;
    }
    const rc = getRenderContext(world);
    if (!rc) return;
    const { ctx, W, H, cellW = 16, cellH = 16 } = rc;
    // Use the viewport size from RenderContext so all renderers agree
    const cols = Math.max(1, rc.cols || Math.floor(W / cellW));
    const rows = Math.max(1, rc.rows || Math.floor(H / cellH));

    // Top-left world tile based on camera (defaults to centering around 0,0)
    const camX = (rc.camX ?? -Math.floor(cols / 2));
    const camY = (rc.camY ?? -Math.floor(rows / 2));
    const startX = camX;
    const startY = camY;

    // Center the tile grid in the canvas (CSS pixel space)
    const ox = Math.floor((W - cols * cellW) / 2);
    const oy = Math.floor((H - rows * cellH) / 2);

    // Shift grid by half a cell so the center of the screen aligns to the
    // center of a tile (especially important when cols/rows are even).
    // This ensures the player (rendered at W/2,H/2) sits in the middle of a square
    // and matches item (gold) placements.
    const halfShiftX = (cols % 2 === 0) ? -cellW / 2 : 0;
    const halfShiftY = (rows % 2 === 0) ? -cellH / 2 : 0;

    ctx.save();
    // Clear background
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, W, H);

    // Draw FPS indicator (top center)
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#fff';
    ctx.fillText(`FPS: ${renderTilesSystem._fps}`, W / 2, 4);

    // Draw a simple checkerboard floor in the visible viewport
    ctx.translate(ox + halfShiftX, oy + halfShiftY);
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const worldX = startX + x;
            const worldY = startY + y;
            const isDark = ((worldX + worldY) & 1) !== 0;
            ctx.fillStyle = isDark ? '#2a2a2a' : '#303030';
            ctx.fillRect(x * cellW, y * cellH, cellW, cellH);
        }
    }

    // Render actual tiles on top
    ctx.font = rc.font || '18px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const [id, pos, tile, glyph] of world.query(Position, Tile, Glyph)) {
        // Only render tiles within the viewport
        const tx = pos.x - startX;
        const ty = pos.y - startY;
        if (tx < 0 || tx >= cols || ty < 0 || ty >= rows) continue;
        const px = tx * cellW + cellW / 2;
        const py = ty * cellH + cellH / 2;
        ctx.fillStyle = (glyph && (glyph.fg || glyph.color)) || '#fff';
        ctx.fillText((glyph && glyph.char) || (tile.glyph || '#'), px, py);
    }
    ctx.restore();
}
