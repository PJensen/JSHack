// Item Renderer System
// Responsible for rendering items on the map
// Assumes existence of item, position, and visibility components
// READONLY: This renderer performs no mutations - only reads world state and draws to canvas

import { getRenderContext } from './renderingUtils.js';
import { Position } from '../../components/Position.js';
import { Glyph } from '../../components/Glyph.js';
import { Gold } from '../../components/Gold.js';
import { Player } from '../../components/Player.js';

export function renderItemsSystem(world) {
    const rc = getRenderContext(world);
    if (!rc) return;
    const { ctx, W, H, cellW=16, cellH=16, font } = rc;
    const cols = Math.max(1, rc.cols|0), rows = Math.max(1, rc.rows|0);
    const camX = rc.camX|0, camY = rc.camY|0;
    const ox = Math.floor((W - cols * cellW) / 2);
    const oy = Math.floor((H - rows * cellH) / 2);
    const halfShiftX = (cols % 2 === 0) ? -cellW / 2 : 0;
    const halfShiftY = (rows % 2 === 0) ? -cellH / 2 : 0;
    
    // Align to tile grid like other renderers
    ctx.save();
    ctx.translate(ox + halfShiftX, oy + halfShiftY);
    ctx.font = font || '16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Render all entities with Gold + Position + Glyph (exclude the player entity)
    for (const [id, pos, glyph, gold] of world.query(Position, Glyph, Gold)) {
        // Skip rendering if this entity is the player (players may also have Gold component)
        if (world.has(id, Player)) continue;
    // Calculate screen position using camera and tile center mapping
    const mx = (pos.x - camX);
    const my = (pos.y - camY);
    // Cull quickly if off visible grid
    if (mx < -1 || my < -1 || mx > cols+1 || my > rows+1) continue;
    const screenX = mx * cellW + cellW * 0.5;
    const screenY = my * cellH + cellH * 0.5;
    ctx.fillStyle = glyph.fg || glyph.color || '#ffd700';
    ctx.fillText(glyph.char || '$', screenX, screenY);
    }
    
    ctx.restore();
}
